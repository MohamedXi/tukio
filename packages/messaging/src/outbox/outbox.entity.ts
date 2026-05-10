import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type OutboxStatus = 'pending' | 'published' | 'failed';

// Template TypeORM entity for the outbox table.
// Each service that uses @tukio/messaging must register this entity via TypeOrmModule.forFeature([OutboxEntity]).
@Entity({ name: 'outbox' })
@Index('idx_outbox_status_created', ['status', 'createdAt'], { where: '"status" = \'pending\'' })
export class OutboxEntity {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id!: string;

  @Column({ name: 'aggregate_type', type: 'text' })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ name: 'event_version', type: 'int' })
  eventVersion!: number;

  // Stores the full event payload.
  // Convention: actor is stored as payload._actor (Sprint 0 simplification;
  // a dedicated actor JSONB column can be added in V1 if pattern becomes cumbersome).
  @Column({ name: 'payload', type: 'jsonb' })
  payload!: object;

  @Column({ name: 'correlation_id', type: 'uuid' })
  correlationId!: string;

  @Column({
    name: 'status',
    type: 'text',
    default: 'pending',
  })
  status!: OutboxStatus;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;
}
