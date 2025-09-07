/**
 * T016 AC6: Telemetry Analytics Entity
 * 
 * Database entity for storing processed analytics and insights from telemetry data
 * TEMPORARY: TypeORM imports commented out for Docker startup fix - needs Prisma migration
 */

// TEMP: TypeORM imports commented out for Prisma compatibility
// import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm'

// TEMP: Entity decorators commented out - needs migration to Prisma schema
// @Entity('telemetry_analytics')
// @Index(['sessionId', 'timestamp'])
// @Index(['userId', 'timestamp'])
// @Index(['projectId', 'timestamp'])
// @Index(['performanceScore', 'timestamp'])
// @Index(['memoryScore', 'timestamp'])
export class TelemetryAnalytics {
  // TEMP: Properties temporarily defined as interface until Prisma migration
  id: string
  sessionId: string
  userId?: string
  projectId?: string
  batchId: string
  metrics: string
  timestamp: Date
  performanceScore: number
  memoryScore: number
  uxScore: number
  errorCount: number
  recommendations?: any[]
  alerts?: any[]
  createdAt: Date

  // TODO: Migrate to Prisma schema and regenerate client types
}

// Original TypeORM implementation - TEMP COMMENTED OUT
/*
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
*/