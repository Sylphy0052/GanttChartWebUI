import { IsString, IsOptional, MaxLength, MinLength, IsDateString, IsEnum, IsNumber, Min, Max, IsArray, IsBoolean } from 'class-validator';

/**
 * CreateIssueDto - Issue作成用DTO
 * 
 * バリデーション:
 * - project_id: URLパラメータから取得するため除外
 * - title: 必須、3-200文字
 * - description_md: オプショナル、最大10000文字
 * - assignee: オプショナル、文字列
 * - status: オプショナル、IssueStatus enum値
 * - start_date: オプショナル、ISO日付文字列
 * - end_date: オプショナル、ISO日付文字列
 * - progress_pct: オプショナル、0-100の整数
 * - effort_hours: オプショナル、正の数値
 * - is_blocked: オプショナル、真偽値
 * - sort_order: オプショナル、整数
 * - labels: オプショナル、文字列配列
 * - parent_id: オプショナル、親Issueの参照用
 */
export class CreateIssueDto {
  // project_id はURLパラメータから取得するため、DTOから除外

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsString()
  @MinLength(3, { message: 'タイトルは3文字以上で入力してください' })
  @MaxLength(200, { message: 'タイトルは200文字以下で入力してください' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000, { message: '説明は10000文字以下で入力してください' })
  description_md?: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsEnum(['open', 'in_progress', 'done', 'blocked'], { 
    message: 'ステータスは open, in_progress, done, blocked のいずれかを指定してください' 
  })
  status?: 'open' | 'in_progress' | 'done' | 'blocked';

  @IsOptional()
  @IsDateString({}, { message: '開始日は有効な日付形式で入力してください' })
  start_date?: string;

  @IsOptional()
  @IsDateString({}, { message: '終了日は有効な日付形式で入力してください' })
  end_date?: string;

  @IsOptional()
  @IsNumber({}, { message: '進捗率は数値で入力してください' })
  @Min(0, { message: '進捗率は0以上で入力してください' })
  @Max(100, { message: '進捗率は100以下で入力してください' })
  progress_pct?: number;

  @IsOptional()
  @IsNumber({}, { message: '工数は数値で入力してください' })
  @Min(0, { message: '工数は0以上で入力してください' })
  effort_hours?: number;

  @IsOptional()
  @IsBoolean()
  is_blocked?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'ソート順は数値で入力してください' })
  sort_order?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'ラベルは文字列の配列で入力してください' })
  labels?: string[];
}