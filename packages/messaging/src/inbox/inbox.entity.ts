import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'inbox' })
@Index('idx_inbox_received', ['receivedAt'], { where: '"processed_at" IS NULL' })
export class InboxEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ name: 'correlation_id', type: 'uuid' })
  correlationId!: string;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'NOW()' })
  receivedAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ name: 'payload', type: 'jsonb' })
  payload!: object;
}
