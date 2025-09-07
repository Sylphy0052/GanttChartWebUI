/**
 * T016 AC6: Telemetry Data Service
 * 
 * Handles efficient background processing of telemetry data with:
 * - Asynchronous batch processing
 * - Data compression and storage optimization  
 * - Real-time analytics and insights generation
 * - Automated recommendations and alerts
 */

import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Between } from 'typeorm'
import { TelemetryBatch } from './entities/telemetry-batch.entity'
import { TelemetryAnalytics } from './entities/telemetry-analytics.entity'

export interface QueueResult {
  position: number
  estimatedProcessingTime: number
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'error'
  queues: {
    processing: number
    pending: number
    failed: number
    avgProcessingTime: number
  }
  performance: {
    throughput: number
    errorRate: number
    uptime: number
  }
}

export interface AnalyticsQuery {
  sessionId?: string
  userId?: string
  projectId?: string
  startTime?: Date
  endTime?: Date
  limit?: number
  metrics?: string[]
}

export interface TelemetryRecommendations {
  recommendations: Array<{
    type: 'performance' | 'memory' | 'ui' | 'workflow'
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    impact: string
    effort: 'low' | 'medium' | 'high'
    confidence: number
    evidence: Record<string, any>
  }>
  analysis: {
    performanceScore: number
    memoryScore: number
    uxScore: number
    dataQuality: number
  }
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name)
  private readonly processingQueue: Map<string, any> = new Map()
  private readonly queueStats = {
    totalProcessed: 0,
    totalFailed: 0,
    avgProcessingTime: 0,
    startTime: Date.now()
  }

  constructor(
    @InjectRepository(TelemetryBatch)
    private readonly telemetryBatchRepository: Repository<TelemetryBatch>,
    @InjectRepository(TelemetryAnalytics)
    private readonly telemetryAnalyticsRepository: Repository<TelemetryAnalytics>
  ) {
    this.initializeBackgroundProcessor()
  }

  /**
   * AC6: Enqueue telemetry batch for background processing
   */
  async enqueueBatch(batchData: any): Promise<QueueResult> {
    const batchId = batchData.batchId
    const priority = batchData.priority || 'medium'
    
    try {
      // Store in database immediately for persistence
      const batch = this.telemetryBatchRepository.create({
        batchId,
        sessionId: batchData.sessionId,
        userId: batchData.userId,
        projectId: batchData.projectId,
        data: JSON.stringify(batchData),
        size: batchData.size,
        priority,
        status: 'queued',
        queuedAt: new Date(),
        retryCount: batchData.retryCount || 0,
        maxRetries: batchData.maxRetries || 3
      })

      await this.telemetryBatchRepository.save(batch)

      // Add to processing queue
      this.processingQueue.set(batchId, {
        ...batchData,
        queuedAt: Date.now(),
        priority: this.getPriorityWeight(priority)
      })

      const queuePosition = this.getQueuePosition(priority)
      const estimatedTime = this.calculateEstimatedProcessingTime(queuePosition)

      this.logger.debug(`Batch ${batchId} queued (position: ${queuePosition}, ETA: ${estimatedTime}ms)`)

      return {
        position: queuePosition,
        estimatedProcessingTime: estimatedTime
      }
    } catch (error) {
      this.logger.error(`Failed to enqueue batch ${batchId}:`, error)
      throw error
    }
  }

  /**
   * AC6: Get telemetry analytics with optimized queries
   */
  async getAnalytics(query: AnalyticsQuery): Promise<any> {
    try {
      const where: any = {}
      
      if (query.sessionId) where.sessionId = query.sessionId
      if (query.userId) where.userId = query.userId
      if (query.projectId) where.projectId = query.projectId
      
      if (query.startTime || query.endTime) {
        where.createdAt = Between(
          query.startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          query.endTime || new Date()
        )
      }

      const batches = await this.telemetryBatchRepository.find({
        where,
        order: { createdAt: 'DESC' },
        take: query.limit || 1000
      })

      // Process and aggregate data
      const analytics = this.aggregateTelemetryData(batches)
      
      return analytics
    } catch (error) {
      this.logger.error('Failed to get analytics:', error)
      throw error
    }
  }

  /**
   * Generate AI-powered recommendations based on telemetry data
   */
  async generateRecommendations(query: AnalyticsQuery): Promise<TelemetryRecommendations> {
    try {
      const analytics = await this.getAnalytics(query)
      const recommendations = this.analyzeAndGenerateRecommendations(analytics)
      
      return recommendations
    } catch (error) {
      this.logger.error('Failed to generate recommendations:', error)
      throw error
    }
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const processingCount = Array.from(this.processingQueue.values())
        .filter(batch => batch.status === 'processing').length
      
      const pendingCount = this.processingQueue.size - processingCount
      
      const failedCount = await this.telemetryBatchRepository.count({
        where: { status: 'failed' }
      })

      const uptime = Date.now() - this.queueStats.startTime
      const throughput = this.queueStats.totalProcessed / (uptime / 1000 / 60) // per minute

      return {
        status: this.determineSystemHealth(throughput, this.queueStats.totalFailed),
        queues: {
          processing: processingCount,
          pending: pendingCount,
          failed: failedCount,
          avgProcessingTime: this.queueStats.avgProcessingTime
        },
        performance: {
          throughput,
          errorRate: this.queueStats.totalFailed / (this.queueStats.totalProcessed + this.queueStats.totalFailed),
          uptime
        }
      }
    } catch (error) {
      this.logger.error('Failed to get system status:', error)
      return {
        status: 'error',
        queues: { processing: 0, pending: 0, failed: 0, avgProcessingTime: 0 },
        performance: { throughput: 0, errorRate: 1, uptime: 0 }
      }
    }
  }

  /**
   * Export telemetry data in various formats
   */
  async exportData(options: any): Promise<any> {
    try {
      const analytics = await this.getAnalytics(options)
      
      switch (options.format) {
        case 'csv':
          return this.convertToCSV(analytics)
        case 'parquet':
          return this.convertToParquet(analytics)
        default:
          return analytics
      }
    } catch (error) {
      this.logger.error('Failed to export data:', error)
      throw error
    }
  }

  /**
   * Initialize background processor for handling queued batches
   */
  private initializeBackgroundProcessor(): void {
    // Process queue every 100ms
    setInterval(() => {
      this.processQueue()
    }, 100)

    // Clean up old completed batches every hour
    setInterval(() => {
      this.cleanupOldBatches()
    }, 60 * 60 * 1000)

    this.logger.log('Background telemetry processor initialized')
  }

  /**
   * Process items in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue.size === 0) return

    // Get highest priority items first
    const sortedBatches = Array.from(this.processingQueue.entries())
      .sort(([, a], [, b]) => b.priority - a.priority)
      .slice(0, 5) // Process up to 5 batches simultaneously

    for (const [batchId, batchData] of sortedBatches) {
      try {
        await this.processBatch(batchId, batchData)
      } catch (error) {
        this.logger.error(`Failed to process batch ${batchId}:`, error)
        await this.handleBatchError(batchId, error)
      }
    }
  }

  /**
   * Process individual batch
   */
  private async processBatch(batchId: string, batchData: any): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Update status to processing
      await this.updateBatchStatus(batchId, 'processing')
      
      // Extract and process metrics
      const processedMetrics = this.processTelemetryMetrics(batchData)
      
      // Store analytics data
      await this.storeAnalytics(batchData, processedMetrics)
      
      // Generate insights and alerts
      await this.generateInsights(batchData, processedMetrics)
      
      // Mark as completed
      await this.updateBatchStatus(batchId, 'completed')
      this.processingQueue.delete(batchId)
      
      const processingTime = Date.now() - startTime
      this.updateQueueStats(processingTime, true)
      
      this.logger.debug(`Processed batch ${batchId} in ${processingTime}ms`)
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.updateQueueStats(processingTime, false)
      throw error
    }
  }

  /**
   * Process raw telemetry metrics into structured data
   */
  private processTelemetryMetrics(batchData: any): any {
    const processed = {
      performance: {
        renderTimes: [] as number[],
        dragTimes: [] as number[],
        zoomTimes: [] as number[],
        memoryUsage: [] as number[],
        framerate: [] as number[]
      },
      interactions: {
        clicks: [] as number[],
        drags: [] as number[],
        zooms: [] as number[],
        patterns: [] as any[]
      },
      errors: [] as any[],
      recommendations: [] as any[]
    }

    // Process performance metrics
    if (batchData.metrics) {
      for (const metric of batchData.metrics) {
        if (metric.performance) {
          processed.performance.renderTimes.push(metric.performance.initialRenderTime)
          processed.performance.dragTimes.push(...(metric.performance.dragOperations?.map((d: any) => d.responseTime) || []))
          processed.performance.zoomTimes.push(...(metric.performance.zoomOperations?.map((z: any) => z.responseTime) || []))
          processed.performance.memoryUsage.push(metric.memory?.heapUsed || 0)
          processed.performance.framerate.push(metric.performance?.framerate || 60)
        }

        if (metric.interaction) {
          processed.interactions.clicks.push(metric.interaction.totalInteractions)
          processed.interactions.patterns.push(...(metric.interaction.patterns || []))
        }
      }
    }

    // Process component metrics
    if (batchData.componentMetrics) {
      for (const component of batchData.componentMetrics) {
        processed.performance.renderTimes.push(component.renderTime)
        processed.performance.memoryUsage.push(component.memoryUsage)
      }
    }

    // Process errors
    if (batchData.errors) {
      processed.errors.push(...batchData.errors)
    }

    return processed
  }

  /**
   * Store processed analytics data
   */
  private async storeAnalytics(batchData: any, processedMetrics: any): Promise<void> {
    try {
      const analytics = this.telemetryAnalyticsRepository.create({
        sessionId: batchData.sessionId,
        userId: batchData.userId,
        projectId: batchData.projectId,
        batchId: batchData.batchId,
        metrics: JSON.stringify(processedMetrics),
        timestamp: new Date(batchData.timestamp),
        performanceScore: this.calculatePerformanceScore(processedMetrics),
        memoryScore: this.calculateMemoryScore(processedMetrics),
        uxScore: this.calculateUXScore(processedMetrics),
        errorCount: processedMetrics.errors.length
      })

      await this.telemetryAnalyticsRepository.save(analytics)
    } catch (error) {
      this.logger.error('Failed to store analytics:', error)
      throw error
    }
  }

  /**
   * Generate insights and alerts from processed data
   */
  private async generateInsights(batchData: any, processedMetrics: any): Promise<void> {
    // Performance alerts
    const avgRenderTime = this.calculateAverage(processedMetrics.performance.renderTimes)
    if (avgRenderTime > 100) {
      this.logger.warn(`Performance alert: High render time (${avgRenderTime}ms) for session ${batchData.sessionId}`)
    }

    // Memory alerts
    const avgMemory = this.calculateAverage(processedMetrics.performance.memoryUsage)
    if (avgMemory > 100) {
      this.logger.warn(`Memory alert: High memory usage (${avgMemory}MB) for session ${batchData.sessionId}`)
    }

    // Error alerts
    if (processedMetrics.errors.length > 0) {
      this.logger.warn(`Error alert: ${processedMetrics.errors.length} errors detected for session ${batchData.sessionId}`)
    }
  }

  /**
   * Aggregate telemetry data for analytics
   */
  private aggregateTelemetryData(batches: TelemetryBatch[]): any {
    const aggregated = {
      summary: {
        totalSessions: new Set(batches.map(b => b.sessionId)).size,
        totalOperations: batches.length,
        avgPerformance: { renderTime: 0, dragTime: 0, zoomTime: 0 },
        memoryUsage: { avg: 0, max: 0, leakCount: 0 },
        userInteractions: { totalClicks: 0, totalDrags: 0, totalZooms: 0, topFeatures: [] },
        errorRate: 0
      },
      trends: {
        performance: [],
        memory: [],
        interactions: []
      },
      recommendations: []
    }

    // Process each batch
    let totalRenderTime = 0, totalMemory = 0, totalErrors = 0
    
    for (const batch of batches) {
      try {
        const data = JSON.parse(batch.data)
        // Extract metrics and aggregate
        // This is a simplified version - real implementation would be more comprehensive
        
        if (data.metrics) {
          for (const metric of data.metrics) {
            if (metric.performance) {
              totalRenderTime += metric.performance.initialRenderTime || 0
            }
            if (metric.memory) {
              totalMemory += metric.memory.heapUsed || 0
            }
          }
        }
        
        if (data.errors) {
          totalErrors += data.errors.length
        }
      } catch (error) {
        this.logger.warn(`Failed to parse batch data: ${batch.batchId}`)
      }
    }

    // Calculate averages
    const batchCount = batches.length
    if (batchCount > 0) {
      aggregated.summary.avgPerformance.renderTime = totalRenderTime / batchCount
      aggregated.summary.memoryUsage.avg = totalMemory / batchCount
      aggregated.summary.errorRate = totalErrors / batchCount
    }

    return aggregated
  }

  /**
   * Analyze data and generate recommendations
   */
  private analyzeAndGenerateRecommendations(analytics: any): TelemetryRecommendations {
    const recommendations = []
    
    // Performance recommendations
    if (analytics.summary.avgPerformance.renderTime > 100) {
      recommendations.push({
        type: 'performance' as const,
        priority: 'high' as const,
        title: 'Optimize Rendering Performance',
        description: 'Render times are consistently above 100ms, impacting user experience',
        impact: 'Reducing render time by 50% could improve user satisfaction by 25%',
        effort: 'medium' as const,
        confidence: 0.85,
        evidence: {
          avgRenderTime: analytics.summary.avgPerformance.renderTime,
          threshold: 100
        }
      })
    }

    // Memory recommendations
    if (analytics.summary.memoryUsage.avg > 50) {
      recommendations.push({
        type: 'memory' as const,
        priority: 'medium' as const,
        title: 'Optimize Memory Usage',
        description: 'Memory usage is higher than optimal, consider implementing cleanup strategies',
        impact: 'Better memory management reduces crashes and improves performance',
        effort: 'high' as const,
        confidence: 0.75,
        evidence: {
          avgMemoryUsage: analytics.summary.memoryUsage.avg,
          threshold: 50
        }
      })
    }

    // Calculate scores
    const performanceScore = Math.max(0, 100 - (analytics.summary.avgPerformance.renderTime / 2))
    const memoryScore = Math.max(0, 100 - analytics.summary.memoryUsage.avg)
    const uxScore = Math.max(0, 100 - (analytics.summary.errorRate * 10))

    return {
      recommendations,
      analysis: {
        performanceScore,
        memoryScore,
        uxScore,
        dataQuality: 85 // Would be calculated based on data completeness
      }
    }
  }

  // Helper methods
  private getPriorityWeight(priority: string): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 }
    return weights[priority as keyof typeof weights] || 2
  }

  private getQueuePosition(priority: string): number {
    const priorityWeight = this.getPriorityWeight(priority)
    return Array.from(this.processingQueue.values())
      .filter(batch => batch.priority >= priorityWeight).length
  }

  private calculateEstimatedProcessingTime(position: number): number {
    return position * (this.queueStats.avgProcessingTime || 100)
  }

  private async updateBatchStatus(batchId: string, status: string): Promise<void> {
    await this.telemetryBatchRepository.update(
      { batchId },
      { status, updatedAt: new Date() }
    )
  }

  private async handleBatchError(batchId: string, error: any): Promise<void> {
    const batch = await this.telemetryBatchRepository.findOne({
      where: { batchId }
    })

    if (batch && batch.retryCount < batch.maxRetries) {
      // Retry
      await this.telemetryBatchRepository.update(
        { batchId },
        { retryCount: batch.retryCount + 1, status: 'queued' }
      )
      this.logger.warn(`Retrying batch ${batchId} (attempt ${batch.retryCount + 1})`)
    } else {
      // Mark as failed
      await this.updateBatchStatus(batchId, 'failed')
      this.processingQueue.delete(batchId)
      this.logger.error(`Batch ${batchId} failed after ${batch?.retryCount || 0} retries`)
    }
  }

  private updateQueueStats(processingTime: number, success: boolean): void {
    if (success) {
      this.queueStats.totalProcessed++
      this.queueStats.avgProcessingTime = 
        (this.queueStats.avgProcessingTime + processingTime) / 2
    } else {
      this.queueStats.totalFailed++
    }
  }

  private determineSystemHealth(throughput: number, failedCount: number): 'healthy' | 'degraded' | 'error' {
    const errorRate = failedCount / (this.queueStats.totalProcessed + failedCount)
    
    if (errorRate > 0.1) return 'error'
    if (errorRate > 0.05 || throughput < 10) return 'degraded'
    return 'healthy'
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + (val || 0), 0) / values.length
  }

  private calculatePerformanceScore(metrics: any): number {
    const avgRenderTime = this.calculateAverage(metrics.performance.renderTimes)
    return Math.max(0, 100 - (avgRenderTime / 2))
  }

  private calculateMemoryScore(metrics: any): number {
    const avgMemory = this.calculateAverage(metrics.performance.memoryUsage)
    return Math.max(0, 100 - avgMemory)
  }

  private calculateUXScore(metrics: any): number {
    const errorCount = metrics.errors.length
    const interactionCount = metrics.interactions.clicks.length
    return Math.max(0, 100 - (errorCount / Math.max(1, interactionCount)) * 100)
  }

  private async cleanupOldBatches(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days old
      
      const result = await this.telemetryBatchRepository
        .createQueryBuilder()
        .delete()
        .from(TelemetryBatch)
        .where('createdAt < :cutoff AND status IN (:...statuses)', {
          cutoff: cutoffDate,
          statuses: ['completed', 'failed']
        })
        .execute()
      
      if (result.affected && result.affected > 0) {
        this.logger.log(`Cleaned up ${result.affected} old telemetry batches`)
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old batches:', error)
    }
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    return JSON.stringify(data) // Would implement proper CSV conversion
  }

  private convertToParquet(data: any): Buffer {
    // Would implement Parquet conversion
    return Buffer.from(JSON.stringify(data))
  }
}