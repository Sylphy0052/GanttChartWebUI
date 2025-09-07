/**
 * T016 AC6: Telemetry Batch Entity
 * 
 * Database entity for storing telemetry batch data with efficient querying and indexing
 */

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('telemetry_batches')
@Index(['sessionId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['projectId', 'createdAt'])
@Index(['status', 'priority', 'createdAt'])
export class TelemetryBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  batchId: string

  @Column()
  @Index()
  sessionId: string

  @Column({ nullable: true })
  @Index()
  userId?: string

  @Column({ nullable: true })
  @Index()
  projectId?: string

  @Column('text')
  data: string

  @Column('int')
  size: number

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  })
  @Index()
  priority: 'low' | 'medium' | 'high' | 'critical'

  @Column({
    type: 'enum',
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued'
  })
  @Index()
  status: 'queued' | 'processing' | 'completed' | 'failed'

  @Column('timestamp')
  queuedAt: Date

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date

  @Column({ type: 'int', default: 0 })
  retryCount: number

  @Column({ type: 'int', default: 3 })
  maxRetries: number

  @Column({ type: 'text', nullable: true })
  errorMessage?: string

  @Column({ type: 'json', nullable: true })
  processingMetrics?: any

  @CreateDateColumn()
  @Index()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}