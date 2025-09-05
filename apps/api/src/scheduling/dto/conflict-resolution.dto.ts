import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';

export enum ConflictResolutionStrategy {
  CURRENT = 'current',
  INCOMING = 'incoming',
  MANUAL = 'manual',
  MERGE = 'merge'
}

export enum DateResolutionRule {
  CURRENT = 'current',
  INCOMING = 'incoming',
  EARLIEST = 'earliest',
  LATEST = 'latest'
}

export enum ProgressResolutionRule {
  CURRENT = 'current',
  INCOMING = 'incoming',
  MAX = 'max',
  AVG = 'avg'
}

export class MergeRules {
  @IsEnum(DateResolutionRule)
  startDate: DateResolutionRule;

  @IsEnum(DateResolutionRule)
  endDate: DateResolutionRule;

  @IsEnum(ProgressResolutionRule)
  progress: ProgressResolutionRule;
}

export class ConflictResolution {
  @IsEnum(ConflictResolutionStrategy)
  strategy: ConflictResolutionStrategy;

  @IsOptional()
  manualValues?: Partial<{
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    progress: number;
    status: string;
    assigneeId: string | null;
    estimateValue: number;
    estimateUnit: string;
  }>;

  @IsOptional()
  mergeRules?: MergeRules;
}

export class ConflictResolutionRequest {
  @IsString()
  conflictId: string;

  resolution: ConflictResolution;
}

export class ConflictResolutionResponse {
  success: boolean;
  resolvedConflict: {
    conflictId: string;
    appliedStrategy: ConflictResolutionStrategy;
    finalValues: any;
  };
  remainingConflicts: number;
}