import type { ChatSocket, AudioAnswerMetadata } from '../../../shared/api'

// UC-02: 녹음이 끝난 답변을 /ws/chats로 전송한다. ChatSocket이 실제 envelope
// 프로토콜(순서: audio:metadata JSON → binary frame)을 처리하므로 여기서는
// 그대로 위임만 한다 — 전송 방식이 바뀌어도 model이 이 함수 시그니처만
// 알면 되게 하기 위한 경계다.
export function sendVoiceAnswer(
  socket: ChatSocket,
  metadata: AudioAnswerMetadata,
  audio: Blob,
): Promise<void> {
  return socket.sendAudioAnswer(metadata, audio)
}
