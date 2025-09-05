import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export enum ScheduleAlgorithm {
  CPM = 'cpm',
  SIMPLE = 'simple'
}

export class ScheduleConstraints {
  @IsArray()
  @IsNumber({}, { each: true })
  workingDays: number[];

  @IsNumber()
  @IsPositive()
  workingHoursPerDay: number;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  holidays?: Date[];
}

export class ScheduleOptions {
  @IsEnum(ScheduleAlgorithm)
  algorithm: ScheduleAlgorithm;

  @IsBoolean()
  autoResolveConflicts: boolean;

  @IsBoolean()
  preserveManualSchedule: boolean;
}

export class ScheduleCalculateRequest {
  @Type(() => ScheduleConstraints)
  constraints: ScheduleConstraints;

  @Type(() => ScheduleOptions)
  options: ScheduleOptions;
}

export class ScheduleApplyRequest {
  computedScheduleId: string;

  applyOptions: {
    conflictResolution: 'overwrite' | 'merge' | 'manual';
    preserveProgress: boolean;
    notifyAssignees: boolean;
  };
}