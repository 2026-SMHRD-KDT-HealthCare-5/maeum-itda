// TODO: replace with real values once apps/backend exposes REST/WebSocket
// endpoints. Kept centralized here so no other layer hardcodes a URL.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:3000'
