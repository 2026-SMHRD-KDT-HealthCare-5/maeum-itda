// Re-exports the cross-app contract types from packages/shared-types.
// packages/shared-types/src/index.ts is still empty (see root CLAUDE.md) —
// once WebSocket event payloads / REST DTOs are pinned there, they surface
// here automatically. Import from '@/shared/types', not the package
// directly, so call sites don't care where the types physically live.
export * from '@maeum-itda/shared-types'
