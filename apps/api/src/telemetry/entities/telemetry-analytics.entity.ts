/**
 * T016 AC6: Telemetry Analytics Entity
 * 
 * Database entity for storing processed analytics and insights from telemetry data
 */

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm'

@Entity('telemetry_analytics')
@Index(['sessionId', 'timestamp'])
@Index(['userId', 'timestamp'])
@Index(['projectId', 'timestamp'])
@Index(['performanceScore', 'timestamp'])
@Index(['memoryScore', 'timestamp'])
export class TelemetryAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  @Index()
  sessionId: string

  @Column({ nullable: true })
  @Index()
  userId?: string

  @Column({ nullable: true })
  @Index()
  projectId?: string

  @Column()
  batchId: string

  @Column('text')
  metrics: string

  @Column('timestamp')
  @Index()
  timestamp: Date

  @Column('decimal', { precision: 5, scale: 2 })
  performanceScore: number

  @Column('decimal', { precision: 5, scale: 2 })
  memoryScore: number

  @Column('decimal', { precision: 5, scale: 2 })
  uxScore: number

  @Column('int', { default: 0 })
  errorCount: number

  @Column({ type: 'json', nullable: true })
  recommendations?: any[]

  @Column({ type: 'json', nullable: true })
  alerts?: any[]

  @CreateDateColumn()
  @Index()
  createdAt: Date
}