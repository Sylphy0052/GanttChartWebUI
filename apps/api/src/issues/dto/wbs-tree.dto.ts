import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsArray, ValidateNested } from 'class-validator'
import { IssueResponseDto } from './issue-response.dto'

export enum WBSNodeStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS', 
  DONE = 'DONE',
  CANCELLED = 'CANCELLED'
}

export class WBSNodeDto {
  @ApiProperty({ description: 'Issue ID' })
  @IsString()
  id: string

  @ApiProperty({ description: 'Issue title' })
  @IsString()
  title: string

  @ApiProperty({ description: 'Issue description', required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ description: 'Parent issue ID', required: false })
  @IsOptional()
  @IsString()
  parentId?: string

  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string

  @ApiProperty({ description: 'Assignee ID', required: false })
  @IsOptional()
  @IsString()
  assigneeId?: string

  @ApiProperty({ description: 'Issue status', enum: WBSNodeStatus })
  @IsEnum(WBSNodeStatus)
  status: WBSNodeStatus

  @ApiProperty({ description: 'Start date', required: false })
  @IsOptional()
  @IsString()
  startDate?: string

  @ApiProperty({ description: 'Due date', required: false })
  @IsOptional()
  @IsString()
  dueDate?: string

  @ApiProperty({ description: 'Estimated hours', required: false })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  @IsNumber()
  progress: number

  @ApiProperty({ description: 'Version for optimistic locking' })
  @IsNumber()
  version: number

  @ApiProperty({ description: 'Hierarchy level (0-based)' })
  @IsNumber()
  level: number

  @ApiProperty({ description: 'Display order' })
  @IsNumber()
  order: number

  @ApiProperty({ description: 'Whether node is expanded in tree view' })
  @IsBoolean()
  isExpanded: boolean

  @ApiProperty({ description: 'Child nodes', type: [WBSNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WBSNodeDto)
  children: WBSNodeDto[]

  @ApiProperty({ description: 'Whether node has children' })
  @IsBoolean()
  hasChildren: boolean

  @ApiProperty({ description: 'Whether node is visible in current view' })
  @IsBoolean()
  isVisible: boolean

  @ApiProperty({ description: 'Node path from root', type: [String] })
  @IsArray()
  @IsString({ each: true })
  path: string[]
}

export class WBSTreeResponseDto {
  @ApiProperty({ description: 'Root nodes of WBS tree', type: [WBSNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WBSNodeDto)
  nodes: WBSNodeDto[]

  @ApiProperty({ description: 'Total number of nodes in tree' })
  @IsNumber()
  totalNodes: number

  @ApiProperty({ description: 'Maximum depth of tree' })
  @IsNumber()
  maxDepth: number

  @ApiProperty({ description: 'Number of visible nodes' })
  @IsNumber()
  visibleNodes: number

  @ApiProperty({ description: 'Tree generation timestamp' })
  @IsString()
  generatedAt: string
}

export class GanttTaskDto {
  @ApiProperty({ description: 'Task ID' })
  @IsString()
  id: string

  @ApiProperty({ description: 'Task title' })
  @IsString()
  title: string

  @ApiProperty({ description: 'Task description', required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ description: 'Parent task ID', required: false })
  @IsOptional()
  @IsString()
  parentId?: string

  @ApiProperty({ description: 'Task start date' })
  @IsString()
  startDate: string

  @ApiProperty({ description: 'Task end date' })
  @IsString()
  endDate: string

  @ApiProperty({ description: 'Task progress (0-100)' })
  @IsNumber()
  progress: number

  @ApiProperty({ description: 'Task status', enum: WBSNodeStatus })
  @IsEnum(WBSNodeStatus)
  status: WBSNodeStatus

  @ApiProperty({ description: 'Assignee ID', required: false })
  @IsOptional()
  @IsString()
  assigneeId?: string

  @ApiProperty({ description: 'Assignee name', required: false })
  @IsOptional()
  @IsString()
  assigneeName?: string

  @ApiProperty({ description: 'Estimated hours', required: false })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number

  @ApiProperty({ description: 'Actual hours spent', required: false })
  @IsOptional()
  @IsNumber()
  actualHours?: number

  @ApiProperty({ description: 'Task hierarchy level' })
  @IsNumber()
  level: number

  @ApiProperty({ description: 'Display order' })
  @IsNumber()
  order: number

  @ApiProperty({ description: 'Task color for display', required: false })
  @IsOptional()
  @IsString()
  color?: string
}

export class GanttDependencyDto {
  @ApiProperty({ description: 'Dependency ID' })
  @IsString()
  id: string

  @ApiProperty({ description: 'Predecessor task ID' })
  @IsString()
  predecessorId: string

  @ApiProperty({ description: 'Successor task ID' })
  @IsString()
  successorId: string

  @ApiProperty({ description: 'Dependency type', enum: ['FS', 'SS', 'FF', 'SF'] })
  @IsEnum(['FS', 'SS', 'FF', 'SF'])
  type: 'FS' | 'SS' | 'FF' | 'SF'

  @ApiProperty({ description: 'Lag time' })
  @IsNumber()
  lag: number

  @ApiProperty({ description: 'Lag unit', enum: ['days', 'hours'] })
  @IsEnum(['days', 'hours'])
  lagUnit: 'days' | 'hours'
}

export class GanttDataResponseDto {
  @ApiProperty({ description: 'Gantt tasks', type: [GanttTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GanttTaskDto)
  tasks: GanttTaskDto[]

  @ApiProperty({ description: 'Task dependencies', type: [GanttDependencyDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GanttDependencyDto)
  dependencies: GanttDependencyDto[]

  @ApiProperty({ description: 'Project start date' })
  @IsString()
  projectStartDate: string

  @ApiProperty({ description: 'Project end date' })
  @IsString()
  projectEndDate: string

  @ApiProperty({ description: 'Total number of tasks' })
  @IsNumber()
  totalTasks: number

  @ApiProperty({ description: 'Data generation timestamp' })
  @IsString()
  generatedAt: string
}

// Query DTOs
export class WBSTreeQueryDto {
  @ApiProperty({ description: 'Project ID to filter by', required: false })
  @IsOptional()
  @IsString()
  projectId?: string

  @ApiProperty({ description: 'Maximum depth to expand', required: false })
  @IsOptional()
  @IsNumber()
  maxDepth?: number

  @ApiProperty({ description: 'Whether to include completed tasks', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  includeCompleted?: boolean

  @ApiProperty({ description: 'Default expand level', required: false, default: 2 })
  @IsOptional()
  @IsNumber()
  expandLevel?: number
}

export class GanttDataQueryDto {
  @ApiProperty({ description: 'Project ID to filter by', required: false })
  @IsOptional()
  @IsString()
  projectId?: string

  @ApiProperty({ description: 'Start date for data range', required: false })
  @IsOptional()
  @IsString()
  startDate?: string

  @ApiProperty({ description: 'End date for data range', required: false })
  @IsOptional()
  @IsString()
  endDate?: string

  @ApiProperty({ description: 'Whether to include dependencies', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  includeDependencies?: boolean

  @ApiProperty({ description: 'Whether to include completed tasks', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  includeCompleted?: boolean
}