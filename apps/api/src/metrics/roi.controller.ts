import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ROIService, ROICalculationResult, ProductivityMetrics, VisibilityMetrics, ManualWorkMetrics, AdoptionMetrics } from './roi.service';

@ApiTags('roi')
@Controller('metrics/roi')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ROIController {
  constructor(private readonly roiService: ROIService) {}

  @Get('calculate/:projectId')
  @ApiOperation({ summary: 'Calculate ROI for a specific project' })
  @ApiResponse({ status: 200, description: 'ROI calculation completed successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Calculation start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Calculation end date (ISO string)' })
  async calculateProjectROI(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<ROICalculationResult> {
    const userId = req.user?.id;
    return this.roiService.calculateROI(projectId, userId);
  }

  @Get('productivity/:projectId')
  async getProductivityMetrics(
    @Param('projectId') projectId: string,
    @Query('userId') userId?: string
  ): Promise<ProductivityMetrics> {
    // Mock implementation for now
    return {
      planningTimeReduced: 25.5,
      updateFrequencyImproved: 15.2,
      taskCompletionAccelerated: 85.3
    };
  }

  @Get('visibility/:projectId')
  async getVisibilityMetrics(
    @Param('projectId') projectId: string,
    @Query('userId') userId?: string
  ): Promise<VisibilityMetrics> {
    // Mock implementation for now
    return {
      projectStatusVisibility: 92.4,
      resourceAllocationOptimization: 15.8,
      stakeholderSatisfaction: 88.7
    };
  }

  @Get('manual-work/:projectId')
  async getManualWorkMetrics(
    @Param('projectId') projectId: string,
    @Query('userId') userId?: string
  ): Promise<ManualWorkMetrics> {
    // Mock implementation for now
    return {
      reportGenerationAutomated: 45.6,
      scheduleMaintenanceReduced: 32.1,
      communicationOverheadReduced: 28.9
    };
  }

  @Get('adoption/:projectId')
  async getAdoptionMetrics(
    @Param('projectId') projectId: string,
    @Query('userId') userId?: string
  ): Promise<AdoptionMetrics> {
    // Mock implementation for now
    return {
      userAdoptionRate: 68.9,
      featureUtilization: 74.2,
      userEngagement: 82.5
    };
  }

  @Get('history/:projectId')
  @ApiOperation({ summary: 'Get ROI calculation history for a project' })
  @ApiResponse({ status: 200, description: 'ROI history retrieved successfully' })
  async getROIHistory(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: number
  ): Promise<any[]> {
    return this.roiService.getROIHistory(projectId, limit || 10);
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Compare ROI across multiple projects' })
  @ApiResponse({ status: 200, description: 'ROI comparison completed' })
  @ApiQuery({ name: 'projectIds', required: true, description: 'Comma-separated project IDs' })
  async compareProjectROI(
    @Query('projectIds') projectIds: string
  ): Promise<any> {
    const ids = projectIds.split(',').map(id => id.trim());
    return this.roiService.generateROIComparison(ids);
  }

  @Get('latest/:projectId')
  @ApiOperation({ summary: 'Get latest ROI report for a project' })
  @ApiResponse({ status: 200, description: 'Latest ROI report retrieved' })
  async getLatestROI(
    @Param('projectId') projectId: string
  ): Promise<any> {
    return this.roiService.getLatestROIReport(projectId);
  }
}