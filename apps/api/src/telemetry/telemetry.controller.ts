/**
 * T016 AC6: Telemetry Data API Controller
 * 
 * Provides efficient API endpoints for telemetry data collection with:
 * - Batch processing without UI blocking
 * - Data compression and optimization
 * - Automatic retry and fallback mechanisms
 * - Real-time processing with background queues
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Headers, Get, Query } from '@nestjs/common'
import { TelemetryService } from './telemetry.service'
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiHeader } from '@nestjs/swagger'

export interface TelemetryBatchDto {
  batchId: string
  timestamp: number
  sessionId: string
  userId?: string
  projectId?: string
  metrics: any[]
  componentMetrics: any[]
  errors: any[]
  compressionApplied: boolean
  size: number
  processingTime: number
  queueTime: number
  metadata: Record<string, any>
  priority: 'low' | 'medium' | 'high' | 'critical'
  retryCount: number
  maxRetries: number
}

export interface TelemetryQueryDto {
  sessionId?: string
  userId?: string
  projectId?: string
  startTime?: number
  endTime?: number
  limit?: number
  metrics?: string[]
}

export interface TelemetryAnalyticsResponse {
  summary: {
    totalSessions: number
    totalOperations: number
    avgPerformance: {
      renderTime: number
      dragTime: number
      zoomTime: number
    }
    memoryUsage: {
      avg: number
      max: number
      leakCount: number
    }
    userInteractions: {
      totalClicks: number
      totalDrags: number
      totalZooms: number
      topFeatures: Array<{ feature: string; usage: number }>
    }
    errorRate: number
  }
  trends: {
    performance: Array<{ timestamp: number; value: number }>
    memory: Array<{ timestamp: number; value: number }>
    interactions: Array<{ timestamp: number; value: number }>
  }
  recommendations: string[]
}

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  private readonly logger = new Logger(TelemetryController.name)

  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * AC6: Receive telemetry batch data with efficient processing
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ 
    summary: 'Submit telemetry batch data',
    description: 'Accepts telemetry data batches for efficient background processing without UI blocking'
  })
  @ApiHeader({
    name: 'X-Telemetry-Compression',
    description: 'Compression method applied to the data',
    required: false,
    enum: ['none', 'gzip', 'brotli']
  })
  @ApiHeader({
    name: 'X-Telemetry-Priority',
    description: 'Processing priority for the batch',
    required: false,
    enum: ['low', 'medium', 'high', 'critical']
  })
  @ApiBody({ 
    description: 'Telemetry batch data with performance metrics, user interactions, and error information',
    type: 'object',
    schema: {
      type: 'object',
      properties: {
        batchId: { type: 'string' },
        timestamp: { type: 'number' },
        sessionId: { type: 'string' },
        userId: { type: 'string' },
        projectId: { type: 'string' },
        metrics: { type: 'array' },
        componentMetrics: { type: 'array' },
        errors: { type: 'array' },
        compressionApplied: { type: 'boolean' },
        size: { type: 'number' },
        processingTime: { type: 'number' },
        queueTime: { type: 'number' },
        metadata: { type: 'object' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        retryCount: { type: 'number' },
        maxRetries: { type: 'number' }
      },
      required: ['batchId', 'timestamp', 'sessionId', 'metrics']
    }
  })
  @ApiResponse({ 
    status: 202, 
    description: 'Telemetry batch accepted for processing',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        batchId: { type: 'string' },
        queuePosition: { type: 'number' },
        estimatedProcessingTime: { type: 'number' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid telemetry data format' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  async submitTelemetryBatch(
    @Body() batchData: TelemetryBatchDto,
    @Headers('X-Telemetry-Compression') compression?: string,
    @Headers('X-Telemetry-Priority') priority?: string,
    @Headers('User-Agent') userAgent?: string,
    @Headers('X-Forwarded-For') clientIp?: string
  ): Promise<{
    success: boolean
    batchId: string
    queuePosition: number
    estimatedProcessingTime: number
    message: string
  }> {
    try {
      this.logger.log(`Received telemetry batch: ${batchData.batchId} (${batchData.size} bytes, priority: ${priority || batchData.priority})`)

      // Validate batch data
      if (!batchData.batchId || !batchData.sessionId || !Array.isArray(batchData.metrics)) {
        this.logger.warn(`Invalid telemetry batch format: ${batchData.batchId}`)
        throw new Error('Invalid batch data format')
      }

      // Add processing context
      const enrichedBatch = {
        ...batchData,
        compressionMethod: compression || 'none',
        priority: (priority as any) || batchData.priority || 'medium',
        clientInfo: {
          userAgent,
          ip: clientIp,
          receivedAt: Date.now()
        }
      }

      // Submit to background processing queue
      const queueResult = await this.telemetryService.enqueueBatch(enrichedBatch)

      this.logger.debug(`Batch ${batchData.batchId} queued at position ${queueResult.position}`)

      return {
        success: true,
        batchId: batchData.batchId,
        queuePosition: queueResult.position,
        estimatedProcessingTime: queueResult.estimatedProcessingTime,
        message: 'Batch accepted for processing'
      }

    } catch (error) {
      this.logger.error(`Failed to process telemetry batch ${batchData.batchId}:`, error)
      
      // Return error response but still accept the data for retry
      return {
        success: false,
        batchId: batchData.batchId,
        queuePosition: -1,
        estimatedProcessingTime: 0,
        message: error instanceof Error ? error.message : 'Processing failed'
      }
    }
  }

  /**
   * AC6: Get telemetry analytics and insights
   */
  @Get('analytics')
  @ApiOperation({ 
    summary: 'Get telemetry analytics',
    description: 'Retrieve processed analytics, trends, and performance insights from telemetry data'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Telemetry analytics data',
    type: 'object'
  })
  async getTelemetryAnalytics(
    @Query() query: TelemetryQueryDto
  ): Promise<TelemetryAnalyticsResponse> {
    try {
      this.logger.log(`Analytics request: ${JSON.stringify(query)}`)
      
      const analytics = await this.telemetryService.getAnalytics({
        sessionId: query.sessionId,
        userId: query.userId,
        projectId: query.projectId,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        limit: Math.min(query.limit || 1000, 10000), // Max 10k records
        metrics: query.metrics ? query.metrics : undefined
      })

      return analytics
    } catch (error) {
      this.logger.error('Failed to get telemetry analytics:', error)
      throw error
    }
  }

  /**
   * Get real-time telemetry status
   */
  @Get('status')
  @ApiOperation({ 
    summary: 'Get telemetry system status',
    description: 'Get current status of telemetry processing queues and system health'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Telemetry system status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'error'] },
        queues: {
          type: 'object',
          properties: {
            processing: { type: 'number' },
            pending: { type: 'number' },
            failed: { type: 'number' },
            avgProcessingTime: { type: 'number' }
          }
        },
        performance: {
          type: 'object',
          properties: {
            throughput: { type: 'number' },
            errorRate: { type: 'number' },
            uptime: { type: 'number' }
          }
        }
      }
    }
  })
  async getTelemetryStatus(): Promise<{
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
    lastUpdated: number
  }> {
    try {
      const status = await this.telemetryService.getSystemStatus()
      return {
        ...status,
        lastUpdated: Date.now()
      }
    } catch (error) {
      this.logger.error('Failed to get telemetry status:', error)
      return {
        status: 'error',
        queues: {
          processing: 0,
          pending: 0,
          failed: 0,
          avgProcessingTime: 0
        },
        performance: {
          throughput: 0,
          errorRate: 1,
          uptime: 0
        },
        lastUpdated: Date.now()
      }
    }
  }

  /**
   * AC6: Health check for telemetry system
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Health check endpoint',
    description: 'Check if telemetry system is operational'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System is healthy' 
  })
  async healthCheck(): Promise<{
    status: 'ok'
    timestamp: number
    version: string
  }> {
    return {
      status: 'ok',
      timestamp: Date.now(),
      version: '1.0.0'
    }
  }

  /**
   * Get performance recommendations based on telemetry data
   */
  @Get('recommendations')
  @ApiOperation({ 
    summary: 'Get performance recommendations',
    description: 'Get AI-powered recommendations based on telemetry analysis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance recommendations',
    schema: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['performance', 'memory', 'ui', 'workflow'] },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              title: { type: 'string' },
              description: { type: 'string' },
              impact: { type: 'string' },
              effort: { type: 'string', enum: ['low', 'medium', 'high'] },
              confidence: { type: 'number' },
              evidence: { type: 'object' }
            }
          }
        },
        analysis: {
          type: 'object',
          properties: {
            performanceScore: { type: 'number' },
            memoryScore: { type: 'number' },
            uxScore: { type: 'number' },
            dataQuality: { type: 'number' }
          }
        }
      }
    }
  })
  async getRecommendations(
    @Query() query: TelemetryQueryDto
  ): Promise<{
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
  }> {
    try {
      const recommendations = await this.telemetryService.generateRecommendations({
        sessionId: query.sessionId,
        userId: query.userId,
        projectId: query.projectId,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined
      })

      return recommendations
    } catch (error) {
      this.logger.error('Failed to get recommendations:', error)
      throw error
    }
  }

  /**
   * Export telemetry data for external analysis
   */
  @Get('export')
  @ApiOperation({ 
    summary: 'Export telemetry data',
    description: 'Export telemetry data in various formats for external analysis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Exported telemetry data' 
  })
  async exportTelemetryData(
    @Query('format') format: 'json' | 'csv' | 'parquet' = 'json',
    @Query() query: TelemetryQueryDto
  ): Promise<any> {
    try {
      this.logger.log(`Export request: format=${format}, query=${JSON.stringify(query)}`)
      
      const data = await this.telemetryService.exportData({
        format,
        ...query,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined
      })

      return data
    } catch (error) {
      this.logger.error('Failed to export telemetry data:', error)
      throw error
    }
  }
}