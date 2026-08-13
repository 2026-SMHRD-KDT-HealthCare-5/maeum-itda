import { WS_BASE_URL } from '../config'
import type {
  AiQuestionPayload,
  AudioAckPayload,
  AudioEndType,
  AuthErrorPayload,
  AuthSuccessPayload,
  ChatEndedPayload,
  ChatIdleWarningPayload,
  ChatRestoredPayload,
  WsErrorPayload,
  WsEvent,
} from '../types'

// docs/ws-protocol.md §5 기준 서버 → 클라이언트 이벤트와 payload 형태.
interface ServerEventMap {
  'auth:success': AuthSuccessPayload
  'auth:error': AuthErrorPayload
  'chat:started': Record<string, never>
  'ai:question': AiQuestionPayload
  'audio:ack': AudioAckPayload
  'chat:idle-warning': ChatIdleWarningPayload
  'chat:ended': ChatEndedPayload
  'chat:restored': ChatRestoredPayload
  error: WsErrorPayload
}

type ServerEventName = keyof ServerEventMap
type Listener<E extends ServerEventName> = (payload: ServerEventMap[E]) => void

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
    this.sendJson('audio:metadata', metadata)
    const buffer = await audio.arrayBuffer()
    this.socket?.send(buffer)
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
    const listeners = this.listeners.get(parsed.event as ServerEventName)
    if (!listeners) return
    for (const listener of listeners) listener(parsed.payload as never)
  }
}
