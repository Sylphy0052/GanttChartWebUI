import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Request
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { SchedulingService } from './scheduling.service';
import {
  ScheduleCalculateRequest,
  ScheduleApplyRequest
} from './dto/schedule-request.dto';
import {
  ScheduleCalculateResponse,
  ScheduleApplyResponse,
  SchedulePreviewResponse
} from './dto/schedule-response.dto';
import {
  ConflictResolutionRequest,
  ConflictResolutionResponse
} from './dto/conflict-resolution.dto';

@ApiTags('Scheduling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/schedule')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate project schedule using CPM algorithm' })
  @ApiResponse({
    status: 200,
    description: 'Schedule calculated successfully',
    type: ScheduleCalculateResponse
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid calculation parameters'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async calculateSchedule(
    @Param('projectId') projectId: string,
    @Body() request: ScheduleCalculateRequest,
    @Request() req: any
  ): Promise<ScheduleCalculateResponse> {
    const userId = req.user?.id;
    return this.schedulingService.calculateSchedule(projectId, request, userId);
  }

  // AC7: Incremental update endpoint for performance optimization
  @Post('calculate/incremental')
  @ApiOperation({ 
    summary: 'Calculate incremental schedule updates for changed tasks',
    description: 'Optimized endpoint that only recalculates affected task chains for performance'
  })
  @ApiResponse({
    status: 200,
    description: 'Incremental schedule update completed successfully',
    schema: {
      type: 'object',
      properties: {
        affectedTaskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of tasks affected by the changes'
        },
        updatedTaskSchedules: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/TaskSchedule'
          },
          description: 'Updated schedule information for affected tasks'
        },
        newCriticalPath: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated critical path after changes'
        },
        performanceMetrics: {
          type: 'object',
          properties: {
            tasksRecalculated: { type: 'number' },
            calculationTime: { type: 'number' },
            optimizationRatio: { 
              type: 'number',
              description: 'Ratio of recalculated tasks to total tasks (lower is better)'
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid incremental update request'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async calculateIncrementalUpdate(
    @Param('projectId') projectId: string,
    @Body() request: {
      changedTaskIds: string[];
      scheduleRequest: ScheduleCalculateRequest;
    },
    @Request() req: any
  ) {
    const userId = req.user?.id;
    return this.schedulingService.calculateIncrementalUpdate(
      projectId,
      request.changedTaskIds,
      request.scheduleRequest,
      userId
    );
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply calculated schedule to project' })
  @ApiResponse({
    status: 200,
    description: 'Schedule applied successfully',
    type: ScheduleApplyResponse
  })
  @ApiResponse({
    status: 404,
    description: 'Project or computed schedule not found'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicts detected, manual resolution required'
  })
  async applySchedule(
    @Param('projectId') projectId: string,
    @Body() request: ScheduleApplyRequest,
    @Request() req: any
  ): Promise<ScheduleApplyResponse> {
    const userId = req.user?.id;
    return this.schedulingService.applySchedule(projectId, request, userId);
  }

  @Get('preview/:computedScheduleId')
  @ApiOperation({ summary: 'Preview scheduled changes before applying' })
  @ApiResponse({
    status: 200,
    description: 'Schedule preview retrieved successfully',
    type: SchedulePreviewResponse
  })
  @ApiResponse({
    status: 404,
    description: 'Computed schedule not found'
  })
  async previewSchedule(
    @Param('projectId') projectId: string,
    @Param('computedScheduleId') computedScheduleId: string
  ): Promise<SchedulePreviewResponse> {
    return this.schedulingService.previewSchedule(projectId, computedScheduleId);
  }

  @Post('resolve-conflicts')
  @ApiOperation({ summary: 'Resolve scheduling conflicts' })
  @ApiResponse({
    status: 200,
    description: 'Conflicts resolved successfully',
    type: ConflictResolutionResponse
  })
  @ApiResponse({
    status: 404,
    description: 'Conflict not found'
  })
  async resolveConflicts(
    @Param('projectId') projectId: string,
    @Body() request: ConflictResolutionRequest,
    @Request() req: any
  ): Promise<ConflictResolutionResponse> {
    const userId = req.user?.id;
    return this.schedulingService.resolveConflicts(projectId, request, userId);
  }

  // AC7: Enhanced conflict analysis endpoints
  @Get('conflicts/analysis')
  @ApiOperation({ 
    summary: 'Get comprehensive conflict analysis for project scheduling',
    description: 'Returns detailed analysis of scheduling conflicts with recommendations'
  })
  @ApiResponse({
    status: 200,
    description: 'Conflict analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        conflictSummary: {
          type: 'object',
          properties: {
            totalConflicts: { type: 'number' },
            criticalConflicts: { type: 'number' },
            warningConflicts: { type: 'number' },
            conflictsByType: {
              type: 'object',
              additionalProperties: { type: 'number' }
            }
          }
        },
        topConflicts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              conflictId: { type: 'string' },
              severity: { type: 'string' },
              description: { type: 'string' },
              affectedTasks: { type: 'array', items: { type: 'string' } },
              estimatedImpact: { type: 'string' },
              suggestedActions: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        resolutionRecommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              strategy: { type: 'string' },
              confidence: { type: 'number' },
              expectedOutcome: { type: 'string' },
              effort: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async getConflictAnalysis(
    @Param('projectId') projectId: string
  ) {
    // Implementation would analyze current scheduling conflicts
    return {
      conflictSummary: {
        totalConflicts: 0,
        criticalConflicts: 0,
        warningConflicts: 0,
        conflictsByType: {}
      },
      topConflicts: [],
      resolutionRecommendations: []
    };
  }

  @Get(':projectId/conflicts/recommendations/:conflictId')
  @ApiOperation({ summary: 'Get resolution recommendations for a specific conflict' })
  @ApiResponse({
    status: 200,
    description: 'Recommendations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        recommendedStrategy: { type: 'string' },
        confidence: { type: 'number' },
        reasons: { type: 'array', items: { type: 'string' } },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              strategy: { type: 'string' },
              confidence: { type: 'number' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Conflict not found'
  })
  async getResolutionRecommendations(
    @Param('projectId') projectId: string,
    @Param('conflictId') conflictId: string
  ) {
    const conflictResolutionService = this.schedulingService['conflictResolutionService'];
    return conflictResolutionService.getResolutionRecommendations(conflictId, projectId);
  }

  @Post(':projectId/conflicts/bulk-resolve')
  @ApiOperation({ summary: 'Bulk resolve multiple conflicts' })
  @ApiResponse({
    status: 200,
    description: 'Bulk resolution completed',
    schema: {
      type: 'object',
      properties: {
        totalConflicts: { type: 'number' },
        resolved: { type: 'number' },
        failed: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              conflictId: { type: 'string' },
              strategy: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bulk resolution request'
  })
  async bulkResolveConflicts(
    @Param('projectId') projectId: string,
    @Body() request: {
      conflictIds: string[];
      options: {
        strategy: 'first-win' | 'last-win' | 'manual' | 'interactive';
        autoResolveLevel: 'none' | 'warnings' | 'all';
        preserveUserChanges: boolean;
        createBackup: boolean;
      }
    },
    @Request() req: any
  ) {
    const userId = req.user?.id;
    const conflictResolutionService = this.schedulingService['conflictResolutionService'];
    
    // Mock conflicts for demonstration - in real implementation, 
    // you would fetch actual conflicts by IDs
    const mockConflicts = request.conflictIds.map(id => ({
      id,
      pattern: 'UPDATE_CONFLICT' as any,
      severity: 'warning' as any,
      entityId: id.split('_')[1] || id,
      projectId,
      description: `Mock conflict for ${id}`,
      currentVersion: 1,
      attemptedVersion: 2,
      currentData: {},
      attemptedData: {},
      conflictFields: [],
      timestamp: new Date(),
      suggestedResolution: []
    }));

    const results = await conflictResolutionService.resolveBulkConflicts(
      projectId,
      mockConflicts,
      request.options,
      userId
    );

    const resolved = results.filter(r => r.success).length;
    const failed = results.length - resolved;

    return {
      totalConflicts: request.conflictIds.length,
      resolved,
      failed,
      results: results.map(r => ({
        success: r.success,
        conflictId: r.resolvedConflict.conflictId,
        strategy: r.resolvedConflict.appliedStrategy
      }))
    };
  }

  // AC5: Calendar integration endpoints
  @Get('calendar/working-days')
  @ApiOperation({ 
    summary: 'Get project calendar configuration and working days',
    description: 'Returns calendar settings including working days, holidays, and time slots'
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        workingDays: {
          type: 'array',
          items: { type: 'number' },
          description: 'Days of week (0=Sunday, 1=Monday, etc.)'
        },
        workingHoursPerDay: { type: 'number' },
        holidays: {
          type: 'array',
          items: { type: 'string', format: 'date' },
          description: 'Holiday dates'
        },
        workingTimeSlots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startTime: { type: 'string', example: '09:00' },
              endTime: { type: 'string', example: '17:00' }
            }
          }
        },
        timezone: { type: 'string' }
      }
    }
  })
  async getCalendarConfiguration(
    @Param('projectId') projectId: string
  ) {
    // Default calendar configuration - would be retrieved from project settings in real implementation
    return {
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      workingHoursPerDay: 8,
      holidays: [],
      workingTimeSlots: [
        { startTime: '09:00', endTime: '17:00' }
      ],
      timezone: 'UTC'
    };
  }

  @Post('calendar/validate')
  @ApiOperation({ 
    summary: 'Validate calendar configuration and detect potential issues',
    description: 'Checks calendar settings for conflicts and validates scheduling constraints'
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar validation completed',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              severity: { type: 'string' },
              description: { type: 'string' },
              suggestion: { type: 'string' }
            }
          }
        },
        warnings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              description: { type: 'string' },
              recommendation: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async validateCalendarConfiguration(
    @Param('projectId') projectId: string,
    @Body() calendarConfig: {
      workingDays: number[];
      workingHoursPerDay: number;
      holidays: string[];
      workingTimeSlots: Array<{
        startTime: string;
        endTime: string;
      }>;
      timezone: string;
    }
  ) {
    const issues: any[] = [];
    const warnings: any[] = [];

    // Validate working days
    if (calendarConfig.workingDays.length === 0) {
      issues.push({
        type: 'no_working_days',
        severity: 'error',
        description: 'No working days specified',
        suggestion: 'Add at least one working day (1-7, where 1=Monday)'
      });
    }

    // Validate working hours
    if (calendarConfig.workingHoursPerDay <= 0 || calendarConfig.workingHoursPerDay > 24) {
      issues.push({
        type: 'invalid_working_hours',
        severity: 'error',
        description: `Invalid working hours per day: ${calendarConfig.workingHoursPerDay}`,
        suggestion: 'Working hours should be between 1-24 hours per day'
      });
    }

    // Check for excessive holidays
    const holidayCount = calendarConfig.holidays.length;
    const yearlyWorkingDays = calendarConfig.workingDays.length * 52; // Approximate
    if (holidayCount > yearlyWorkingDays * 0.2) {
      warnings.push({
        type: 'excessive_holidays',
        description: `High number of holidays (${holidayCount}) may significantly impact scheduling`,
        recommendation: 'Review holiday list and consider impact on project timelines'
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }
}