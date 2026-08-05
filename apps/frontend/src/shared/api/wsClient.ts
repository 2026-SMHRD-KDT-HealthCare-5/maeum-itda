import { WS_BASE_URL } from '../config'

// TODO: reconnect/backoff handling (NFR-RE-001) once apps/backend's
// WebSocket contract (event names/payloads, to be pinned in
// packages/shared-types) exists. This just opens a raw connection for now.
export function connectConversationSocket(path: string): WebSocket {
  return new WebSocket(`${WS_BASE_URL}${path}`)
}
