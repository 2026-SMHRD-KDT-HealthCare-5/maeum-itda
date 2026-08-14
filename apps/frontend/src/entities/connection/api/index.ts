import type { ConnectionResponseDto } from '@maeum-itda/api-client'
import { apiClient } from '../../../shared/api'
import type { Connection } from '../model'

// ConnectionResponseDto의 relationshipId/requestedAt/connectedAt은 백엔드
// DTO에 명시적 @ApiProperty 타입이 없어 swagger-typescript-api가 `object | null`로
// 생성한다 — 실제 런타임 값은 number/string이므로(connections.controller.ts 기준)
// 여기서만 좁혀서 entities/connection의 Connection 타입으로 맞춘다.
function toConnection(dto: ConnectionResponseDto): Connection {
  return {
    relationshipId: dto.relationshipId as number | null,
    status: dto.status,
    requestedAt: dto.requestedAt as string | null,
    connectedAt: dto.connectedAt as string | null,
    counterpart: dto.counterpart,
  }
}

export async function fetchMyConnection(): Promise<Connection> {
  const { data } = await apiClient.connections.connectionsControllerGetMyConnection()
  return toConnection(data)
}

// 보호자 전용(백엔드가 403으로 강제) — seniorLoginId로 시니어에게 연결 요청.
export async function sendConnectionRequest(seniorLoginId: string): Promise<Connection> {
  const { data } = await apiClient.connections.connectionsControllerCreateRequest({
    seniorLoginId,
  })
  return toConnection(data)
}

// 시니어 전용(백엔드가 403으로 강제) — 받은 연결 요청 수락.
export async function acceptConnectionRequest(relationshipId: number): Promise<Connection> {
  const { data } = await apiClient.connections.connectionsControllerAcceptRequest(relationshipId)
  return toConnection(data)
}

// 시니어 전용 — 받은 연결 요청 거절.
export async function rejectConnectionRequest(relationshipId: number): Promise<void> {
  await apiClient.connections.connectionsControllerRejectRequest(relationshipId)
}

// 보호자 전용 — 보낸(아직 수락되지 않은) 연결 요청 취소.
export async function cancelConnectionRequest(relationshipId: number): Promise<void> {
  await apiClient.connections.connectionsControllerCancelRequest(relationshipId)
}

// 시니어/보호자 공용 — 현재 연결된(CONNECTED) 관계 해제.
export async function disconnectConnection(): Promise<void> {
  await apiClient.connections.connectionsControllerDisconnect()
}
