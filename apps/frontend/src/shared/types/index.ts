// Re-exports the cross-app contract types from packages/shared-types
// (WebSocket event payloads, REST DTOs). Import from '@/shared/types', not
// the package directly, so call sites don't care where the types physically live.
export * from '@maeum-itda/shared-types'
