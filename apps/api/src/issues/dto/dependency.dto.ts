import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsUUID } from 'class-validator';

// T032: Enhanced dependency types for advanced project scheduling
export enum DependencyType {
  FS = 'FS', // Finish-to-Start (existing)
  SS = 'SS', // Start-to-Start (new)
  SF = 'SF', // Start-to-Finish (new) 
  FF = 'FF'  // Finish-to-Finish (new)
}

export class CreateDependencyDto {
  @ApiProperty({ 
    description: 'Predecessor issue ID (the issue that determines when successor can start/finish)',
    example: 'uuid-predecessor-issue'
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  predecessorId: string;

  @ApiProperty({ 
    description: 'Successor issue ID (the issue that depends on the predecessor)',
    example: 'uuid-successor-issue'
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  successorId: string;

  @ApiProperty({ 
    description: 'Dependency type: FS (Finish-to-Start), SS (Start-to-Start), SF (Start-to-Finish), FF (Finish-to-Finish)',
    enum: DependencyType,
    default: DependencyType.FS,
    examples: {
      'FS': { value: 'FS', description: 'Predecessor must finish before successor starts' },
      'SS': { value: 'SS', description: 'Predecessor must start before successor starts' },
      'SF': { value: 'SF', description: 'Predecessor must start before successor finishes' },
      'FF': { value: 'FF', description: 'Predecessor must finish before successor finishes' }
    }
  })
  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType = DependencyType.FS;

  @ApiProperty({ 
    description: 'Lag time in hours - positive values for delays, negative for leads (overlaps)',
    example: 0,
    default: 0,
    examples: {
      'no_lag': { value: 0, description: 'No lag time' },
      'delay': { value: 24, description: '1 day delay after dependency condition met' },
      'lead': { value: -12, description: '12 hours overlap/lead time' }
    }
  })
  @IsOptional()
  @IsNumber()
  lag?: number = 0;
}

export class DependencyResponseDto {
  @ApiProperty({ description: 'Dependency ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Predecessor issue ID' })
  predecessorId: string;

  @ApiProperty({ description: 'Successor issue ID' })
  successorId: string;

  @ApiProperty({ 
    description: 'Dependency type', 
    enum: DependencyType,
    examples: {
      'FS': { value: 'FS', description: 'Finish-to-Start dependency' },
      'SS': { value: 'SS', description: 'Start-to-Start dependency' },
      'SF': { value: 'SF', description: 'Start-to-Finish dependency' },
      'FF': { value: 'FF', description: 'Finish-to-Finish dependency' }
    }
  })
  type: DependencyType;

  @ApiProperty({ 
    description: 'Lag time in hours', 
    examples: {
      'no_lag': { value: 0, description: 'No lag time' },
      'positive_lag': { value: 24, description: '1 day delay' },
      'negative_lag': { value: -12, description: '12 hours lead/overlap' }
    }
  })
  lag: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Update timestamp' })
  updatedAt: string;

  // T032: Additional computed fields for UI display
  @ApiProperty({ 
    description: 'Human-readable lag time display (e.g., "+2d", "-1d", "0h")', 
    examples: {
      'days_delay': { value: '+2d', description: '2 days delay' },
      'hours_lead': { value: '-12h', description: '12 hours lead' },
      'no_lag': { value: '0h', description: 'No lag' }
    }
  })
  lagDisplay?: string;

  @ApiProperty({ 
    description: 'Dependency description for UI tooltips',
    examples: {
      'FS': { value: 'Task B starts after Task A finishes', description: 'FS dependency' },
      'SS': { value: 'Task B starts after Task A starts', description: 'SS dependency' },
      'SF': { value: 'Task B finishes after Task A starts', description: 'SF dependency' },
      'FF': { value: 'Task B finishes after Task A finishes', description: 'FF dependency' }
    }
  })
  description?: string;
}

export class UpdateDependencyDto {
  @ApiProperty({ 
    description: 'Updated dependency type',
    enum: DependencyType,
    required: false
  })
  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType;

  @ApiProperty({ 
    description: 'Updated lag time in hours',
    required: false
  })
  @IsOptional()
  @IsNumber()
  lag?: number;
}

export class DeleteDependencyDto {
  @ApiProperty({ 
    description: 'Successor issue ID to remove dependency for',
    example: 'uuid-successor-issue'
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  successorId: string;
}

// T032: Utility functions for dependency calculations
export class DependencyUtils {
  static formatLagDisplay(lagHours: number): string {
    if (lagHours === 0) return '0h';
    
    const absDays = Math.floor(Math.abs(lagHours) / 24);
    const remainingHours = Math.abs(lagHours) % 24;
    const sign = lagHours > 0 ? '+' : '-';
    
    if (absDays > 0 && remainingHours === 0) {
      return `${sign}${absDays}d`;
    } else if (absDays > 0 && remainingHours > 0) {
      return `${sign}${absDays}d${remainingHours}h`;
    } else {
      return `${sign}${Math.abs(lagHours)}h`;
    }
  }

  static getDependencyDescription(type: DependencyType, predecessorName?: string, successorName?: string): string {
    const pred = predecessorName || 'predecessor';
    const succ = successorName || 'successor';
    
    const descriptions: Record<DependencyType, string> = {
      [DependencyType.FS]: `${succ} starts after ${pred} finishes`,
      [DependencyType.SS]: `${succ} starts after ${pred} starts`,
      [DependencyType.SF]: `${succ} finishes after ${pred} starts`,
      [DependencyType.FF]: `${succ} finishes after ${pred} finishes`
    };
    
    return descriptions[type];
  }

  static getVisualStyle(type: DependencyType): { 
    color: string; 
    strokeDasharray: string; 
    strokeWidth: number;
  } {
    const styles = {
      [DependencyType.FS]: { color: '#64748b', strokeDasharray: 'none', strokeWidth: 2 }, // Gray solid
      [DependencyType.SS]: { color: '#3b82f6', strokeDasharray: '5,5', strokeWidth: 2 },   // Blue dashed
      [DependencyType.SF]: { color: '#f97316', strokeDasharray: '2,3', strokeWidth: 2 },   // Orange dotted
      [DependencyType.FF]: { color: '#10b981', strokeDasharray: 'none', strokeWidth: 2.5 } // Green solid
    };
    
    return styles[type];
  }
}