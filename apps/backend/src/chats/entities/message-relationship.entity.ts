import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MessageRelationshipType {
  ANSWER = 'ANSWER',
  ADDITIONAL_ANSWER = 'ADDITIONAL_ANSWER',
}

@Entity({ name: 'MESSAGE_RELATIONSHIP' })
@Index(
  'UK_MESSAGE_RELATIONSHIP',
  ['sourceMessageId', 'targetMessageId', 'relationshipType'],
  { unique: true },
)
@Index('IX_RELATIONSHIP_TARGET_MESSAGE', ['targetMessageId'])
@Check(
  'CK_RELATIONSHIP_DIFFERENT_MESSAGES',
  'SOURCE_MESSAGE_ID <> TARGET_MESSAGE_ID',
)
export class MessageRelationship {
  @PrimaryGeneratedColumn({ name: 'RELATIONSHIP_ID', type: 'int' })
  relationshipId: number;

  @Column({ name: 'SOURCE_MESSAGE_ID', type: 'int' })
  sourceMessageId: number;

  @Column({ name: 'TARGET_MESSAGE_ID', type: 'int' })
  targetMessageId: number;

  @Column({
    name: 'RELATIONSHIP_TYPE',
    type: 'enum',
    enum: MessageRelationshipType,
  })
  relationshipType: MessageRelationshipType;
}
