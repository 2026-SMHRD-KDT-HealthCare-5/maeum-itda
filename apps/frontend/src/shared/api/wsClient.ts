import { WS_BASE_URL } from '../config'
import type { AudioEndType, ServerWsEventMap, WsEvent } from '../types'

// 이벤트명·payload 형태는 packages/shared-types의 ServerWsEventMap이 기준이다
// (여기서 따로 유지하면 새 이벤트 추가 때마다 둘 다 고쳐야 해서 드리프트가 생긴다).
type ServerEventName = keyof ServerWsEventMap
type Listener<E extends ServerEventName> = (payload: ServerWsEventMap[E]) => void

export interface AudioAnswerMetadata {
  audioTransferId: string
  questionMessageId: number
  generationId: string
  mimeType: string
  capturedAt: string
  endType: AudioEndType
}

// docs/ws-protocol.md 기준 /ws/chats 클라이언트. envelope(event/payload/ts)
// 생성, 인증 첫 메시지, JSON/바이너리 프레임 순서 전송, 이벤트별 리스너 등록을
// 한 곳에 모아 개별 feature가 raw WebSocket을 직접 다루지 않게 한다.
export class ChatSocket {
  private socket: WebSocket | null = null
  private readonly listeners = new Map<ServerEventName, Set<Listener<never>>>()
  // 임시 지연 진단용 — 음성 답변을 보낸 시각을 기록해, 다음 질문(ai:question)이
  // 도착할 때까지 걸린 시간을 잰다. 한 소켓에서 답변→다음 질문은 항상 순차적으로만
  // 오가므로(동시에 여러 질문이 대기 중일 수 없음) 단일 필드로 충분하다. DEV
  // 빌드에만 걸려있지 않아 배포된 PWA에서도(브라우저 콘솔로) 확인 가능하다.
  // 원인 파악 끝나면 지울 것.
  private pendingAudioSentAt: number | null = null

  // 연결 → auth 전송 → auth:success/auth:error 응답까지 기다린다.
  connect(accessToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${WS_BASE_URL}/ws/chats`)
      socket.binaryType = 'arraybuffer'
      this.socket = socket
      socket.addEventListener('message', (event) => this.handleMessage(event))

      const cleanup = () => {
        this.off('auth:success', onAuthSuccess)
        this.off('auth:error', onAuthError)
      }
      const onAuthSuccess: Listener<'auth:success'> = () => {
        cleanup()
        resolve()
      }
      const onAuthError: Listener<'auth:error'> = (payload) => {
        cleanup()
        reject(new Error(payload.message))
      }
      this.on('auth:success', onAuthSuccess)
      this.on('auth:error', onAuthError)

      socket.addEventListener('open', () => this.sendJson('auth', { accessToken }), { once: true })
      socket.addEventListener(
        'error',
        () => {
          cleanup()
          reject(new Error('WebSocket 연결에 실패했습니다.'))
        },
        { once: true },
      )
    })
  }

  disconnect(): void {
    this.socket?.close()
    this.socket = null
  }

  onClose(listener: (event: CloseEvent) => void): void {
    this.socket?.addEventListener('close', listener)
  }

  startChat(): void {
    this.sendJson('chat:start', {})
  }

  endChat(): void {
    this.sendJson('chat:end', { reason: 'USER_REQUESTED' })
  }

  // metadata를 먼저 보내고 다음 프레임으로 음성 바이너리를 보낸다
  // (docs/ws-protocol.md §5.3 — 두 전송 사이 순서가 뒤바뀌면 안 된다).
  async sendAudioAnswer(metadata: AudioAnswerMetadata, audio: Blob): Promise<void> {
    this.pendingAudioSentAt = Date.now()
    this.sendJson('audio:metadata', metadata)
    const buffer = await audio.arrayBuffer()
    this.socket?.send(buffer)
  }

  // 발화 중 pcm16 LE mono(24kHz) 청크 — NestJS가 FastAPI live STT로 중계한다.
  sendAudioPcm(payload: {
    questionMessageId: number
    generationId: string
    pcmBase64: string
  }): void {
    this.sendJson('audio:pcm', payload)
  }

  on<E extends ServerEventName>(event: E, listener: Listener<E>): void {
    this.listenersFor(event).add(listener as Listener<never>)
  }

  off<E extends ServerEventName>(event: E, listener: Listener<E>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>)
  }

  private listenersFor<E extends ServerEventName>(event: E): Set<Listener<never>> {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    return set
  }

  private sendJson<TEvent extends string, TPayload>(event: TEvent, payload: TPayload): void {
    const envelope: WsEvent<TEvent, TPayload> = { event, payload, ts: new Date().toISOString() }
    this.socket?.send(JSON.stringify(envelope))
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return // 바이너리(TTS)는 MVP 범위 밖(docs/ws-protocol.md §6)
    let parsed: WsEvent<string, unknown>
    try {
      parsed = JSON.parse(event.data)
    } catch {
      return
    }
    // 임시 지연 진단 로그 — "음성 답변 전송 → 다음 질문 도착"까지 걸린 총
    // 시간(사용자가 느끼는 "생각 중" 대기시간 그 자체)을 잰다. DEV 여부와
    // 무관하게 항상 찍혀 배포된 PWA 브라우저 콘솔에서도 바로 보인다.
    // 원인 파악 끝나면 지울 것.
    if (parsed.event === 'ai:question' && this.pendingAudioSentAt !== null) {
      console.log(
        `[LATENCY] 음성 전송 → 다음 질문 도착 = ${Date.now() - this.pendingAudioSentAt}ms`,
      )
      this.pendingAudioSentAt = null
    }
    // 각 이벤트가 서버에서 찍힌 시각(ts)과 브라우저에 도착한 시각을 같이 남긴다.
    // 원인 파악 끝나면 지울 것.
    if (import.meta.env.DEV) {
      console.log(
        '[ChatSocket]',
        parsed.event,
        'server ts=',
        parsed.ts,
        'client received=',
        new Date().toISOString(),
      )
    }
    const listeners = this.listeners.get(parsed.event as ServerEventName)
    if (!listeners) return
    for (const listener of listeners) listener(parsed.payload as never)
  }
}
