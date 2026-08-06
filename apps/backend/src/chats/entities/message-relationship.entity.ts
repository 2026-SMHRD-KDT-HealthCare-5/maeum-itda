/*
역할: 메시지 사이의 답변·응답 관계 객체와 MESSAGE_RELATIONSHIP 테이블을 연결한다.
전체 흐름: ChatsService → Repository<MessageRelationship> → MySQL
*/
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MessageRelationshipType {
  ANSWER = 'ANSWER',
  ADDITIONAL_ANSWER = 'ADDITIONAL_ANSWER',
  RESPONSE = 'RESPONSE',
  CORRECTION = 'CORRECTION',
  CONTINUATION = 'CONTINUATION',
}

// sourceMessageId와 targetMessageId로 세션 없이 메시지 사이의 방향을 저장한다.
@Entity({ name: 'MESSAGE_RELATIONSHIP' })
@Index(
  'UK_MESSAGE_RELATIONSHIP',
  ['sourceMessageId', 'targetMessageId', 'relationshipType'],
  { unique: true },
)
@Check('CK_MR_DIFFERENT_MESSAGES', 'SOURCE_MESSAGE_ID <> TARGET_MESSAGE_ID')
export class MessageRelationship {
  @PrimaryGeneratedColumn({ name: 'RELATIONSHIP_ID', type: 'int' })
  relationshipId: number;
  @Column({ name: 'SOURCE_MESSAGE_ID', type: 'int' }) sourceMessageId: number;
  @Column({ name: 'TARGET_MESSAGE_ID', type: 'int' }) targetMessageId: number;
  @Column({
    name: 'RELATIONSHIP_TYPE',
    type: 'enum',
    enum: MessageRelationshipType,
  })
  relationshipType: MessageRelationshipType;
}
