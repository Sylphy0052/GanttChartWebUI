import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { SettingsService } from '../settings/settings.service';
import { CreateDependencyDto, DependencyResponseDto } from './dto';
import { Dependency } from '@prisma/client';
import {
  ScheduleAdjustmentResult,
  ScheduleAdjustmentParams,
  ScheduleIssue,
  ScheduleDependency,
  AdjustedIssue,
  ConstraintViolation,
  BusinessDayConfig,
} from './interfaces/schedule-adjustment.interface';
import { ScheduleCalculatorUtil } from './utils/schedule-calculator.util';

/**
 * DependenciesService - 依存関係管理サービス（日程調整機能統合版）
 * 
 * 機能:
 * - 依存関係のCRUD操作
 * - 循環依存検証アルゴリズム
 * - FS依存関係に基づく日程自動調整
 * - GlobalSettings休日考慮の営業日計算
 * - 変更履歴記録
 * - リアルタイム通知
 */
@Injectable()
export class DependenciesService {
  private readonly logger = new Logger(DependenciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLogService: ChangeLogService,
    private readonly notificationGateway: NotificationGateway,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 依存関係作成（循環依存検証・日程調整付き）
   */
  async create(projectId: string, createDependencyDto: CreateDependencyDto): Promise<DependencyResponseDto> {
    const { predecessor_issue_id, successor_issue_id, type = 'FS' } = createDependencyDto;

    // 1. Issue存在確認
    await this.validateIssuesExist(projectId, predecessor_issue_id, successor_issue_id);

    // 2. 自己依存チェック
    if (predecessor_issue_id === successor_issue_id) {
      throw new BadRequestException('Issue cannot depend on itself');
    }

    // 3. 既存依存関係チェック
    const existingDependency = await this.prisma.dependency.findFirst({
      where: {
        predecessor_issue_id,
        successor_issue_id,
      },
    });

    if (existingDependency) {
      throw new BadRequestException('Dependency already exists between these issues');
    }

    // 4. 循環依存チェック
    await this.checkCyclicDependency(predecessor_issue_id, successor_issue_id);

    // 5. 依存関係作成
    const dependency = await this.prisma.dependency.create({
      data: {
        project_id: projectId,
        predecessor_issue_id,
        successor_issue_id,
        type,
      },
      include: {
        predecessor: { select: { id: true, title: true } },
        successor: { select: { id: true, title: true } },
      },
    });

    // 6. 日程自動調整実行
    let adjustmentResult: ScheduleAdjustmentResult | null = null;
    try {
      adjustmentResult = await this.adjustScheduleForDependency(projectId, successor_issue_id);
      if (!adjustmentResult.success) {
        this.logger.warn(`Schedule adjustment warnings for dependency ${dependency.id}:`, adjustmentResult.constraint_violations);
      }
    } catch (adjustmentError) {
      this.logger.error(`Schedule adjustment failed for dependency ${dependency.id}:`, adjustmentError);
      // 日程調整失敗は依存関係作成を阻害しない（警告レベル）
    }

    // 7. 変更履歴記録
    await this.changeLogService.recordIssueChange(
      dependency.id,
      { action: 'create', dependency },
      projectId,
    );

    // 8. WebSocket通知（日程調整結果を含む）
    try {
      await this.notificationGateway.sendNotification({
        target: 'PROJECT',
        notification: {
          event: 'dependency:created',
          data: {
            message: `依存関係が作成されました: ${dependency.predecessor?.title} → ${dependency.successor?.title}`,
            timestamp: new Date().toISOString(),
            projectId,
            entityType: 'dependency',
            entityId: dependency.id,
            entity: dependency,
            // ガント関連の追加データ
            dependencyId: dependency.id,
            adjustedIssues: adjustmentResult?.adjusted_issues || [],
            scheduleAdjustmentResult: adjustmentResult,
          },
        },
        projectId,
      });

      // 日程調整が発生した場合、専用通知も送信
      if (adjustmentResult && adjustmentResult.adjusted_issues.length > 0) {
        await this.notificationGateway.sendNotification({
          target: 'PROJECT',
          notification: {
            event: 'schedule_adjustment',
            data: {
              message: `依存関係作成により${adjustmentResult.adjusted_issues.length}個のタスクの日程が調整されました`,
              timestamp: new Date().toISOString(),
              projectId,
              entityType: 'dependency',
              entityId: dependency.id,
              adjustedIssues: adjustmentResult.adjusted_issues,
              scheduleAdjustmentResult: adjustmentResult,
            },
          },
          projectId,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to send dependency creation notification: ${error.message}`);
      // 通知失敗は依存関係作成を阻害しない
    }

    this.logger.log(`Dependency created: ${predecessor_issue_id} -> ${successor_issue_id}`);

    return new DependencyResponseDto(dependency);
  }

  /**
   * プロジェクト内依存関係一覧取得
   */
  async findByProjectId(projectId: string): Promise<DependencyResponseDto[]> {
    const dependencies = await this.prisma.dependency.findMany({
      where: { project_id: projectId },
      include: {
        predecessor: { select: { id: true, title: true } },
        successor: { select: { id: true, title: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return dependencies.map(dep => new DependencyResponseDto(dep));
  }

  /**
   * 依存関係削除（日程再調整付き）
   */
  async remove(id: string): Promise<void> {
    const dependency = await this.prisma.dependency.findUnique({
      where: { id },
      include: {
        predecessor: { select: { id: true, title: true } },
        successor: { select: { id: true, title: true } },
      },
    });

    if (!dependency) {
      throw new NotFoundException(`Dependency with ID ${id} not found`);
    }

    const projectId = dependency.project_id;
    const successorId = dependency.successor_issue_id;

    // 依存関係削除
    await this.prisma.dependency.delete({
      where: { id },
    });

    // 日程再調整実行（依存関係削除により制約が緩和される可能性）
    let adjustmentResult: ScheduleAdjustmentResult | null = null;
    try {
      adjustmentResult = await this.adjustScheduleForProject(projectId);
    } catch (adjustmentError) {
      this.logger.error(`Schedule adjustment failed after dependency deletion ${id}:`, adjustmentError);
      // 日程調整失敗は依存関係削除を阻害しない
    }

    // 変更履歴記録
    await this.changeLogService.recordIssueChange(
      id,
      { action: 'delete', dependency },
      projectId,
    );

    // WebSocket通知（日程調整結果を含む）
    try {
      await this.notificationGateway.sendNotification({
        target: 'PROJECT',
        notification: {
          event: 'dependency:deleted',
          data: {
            message: `依存関係が削除されました: ${dependency.predecessor?.title} → ${dependency.successor?.title}`,
            timestamp: new Date().toISOString(),
            projectId,
            entityType: 'dependency',
            entityId: id,
            entity: dependency,
            // ガント関連の追加データ
            dependencyId: id,
            adjustedIssues: adjustmentResult?.adjusted_issues || [],
            scheduleAdjustmentResult: adjustmentResult,
          },
        },
        projectId,
      });

      // 日程調整が発生した場合、専用通知も送信
      if (adjustmentResult && adjustmentResult.adjusted_issues.length > 0) {
        await this.notificationGateway.sendNotification({
          target: 'PROJECT',
          notification: {
            event: 'schedule_adjustment',
            data: {
              message: `依存関係削除により${adjustmentResult.adjusted_issues.length}個のタスクの日程が調整されました`,
              timestamp: new Date().toISOString(),
              projectId,
              entityType: 'dependency',
              entityId: id,
              adjustedIssues: adjustmentResult.adjusted_issues,
              scheduleAdjustmentResult: adjustmentResult,
            },
          },
          projectId,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to send dependency deletion notification: ${error.message}`);
      // 通知失敗は依存関係削除を阻害しない
    }

    this.logger.log(`Dependency deleted: ${id}`);
  }

  /**
   * 特定の後続Issue用の日程調整
   * 
   * @param projectId プロジェクトID
   * @param successorIssueId 後続IssueID
   * @returns 調整結果
   */
  async adjustScheduleForDependency(
    projectId: string,
    successorIssueId: string,
  ): Promise<ScheduleAdjustmentResult> {
    const params: ScheduleAdjustmentParams = {
      project_id: projectId,
      trigger_issue_id: successorIssueId,
      business_day_config: await this.getBusinessDayConfig(),
      calculate_critical_path: false, // 個別調整では計算しない
    };

    return this.performScheduleAdjustment(params);
  }

  /**
   * プロジェクト全体の日程調整
   * 
   * @param projectId プロジェクトID
   * @returns 調整結果
   */
  async adjustScheduleForProject(projectId: string): Promise<ScheduleAdjustmentResult> {
    const params: ScheduleAdjustmentParams = {
      project_id: projectId,
      business_day_config: await this.getBusinessDayConfig(),
      calculate_critical_path: true,
    };

    return this.performScheduleAdjustment(params);
  }

  /**
   * 日程調整実行（コアロジック）
   * 
   * @param params 調整パラメータ
   * @returns 調整結果
   */
  private async performScheduleAdjustment(
    params: ScheduleAdjustmentParams,
  ): Promise<ScheduleAdjustmentResult> {
    try {
      // 1. プロジェクト内のIssueと依存関係を取得
      const [issues, dependencies] = await Promise.all([
        this.getProjectIssues(params.project_id),
        this.getProjectDependencies(params.project_id),
      ]);

      // 2. 依存関係チェーンの順序で日程調整
      const adjustedIssues: AdjustedIssue[] = [];
      const violations: ConstraintViolation[] = [];

      // 特定のIssueのみ調整する場合
      if (params.trigger_issue_id) {
        const adjustmentResult = await this.adjustSingleIssueSchedule(
          params.trigger_issue_id,
          issues,
          dependencies,
          params.business_day_config,
        );
        
        if (adjustmentResult) {
          adjustedIssues.push(adjustmentResult);
        }
      } else {
        // プロジェクト全体の調整
        const topologicalOrder = this.getTopologicalOrder(issues, dependencies);
        
        for (const issueId of topologicalOrder) {
          const adjustmentResult = await this.adjustSingleIssueSchedule(
            issueId,
            issues,
            dependencies,
            params.business_day_config,
          );
          
          if (adjustmentResult) {
            adjustedIssues.push(adjustmentResult);
          }
        }
      }

      return {
        success: true,
        adjusted_issues: adjustedIssues,
        constraint_violations: violations,
        critical_path: null, // 後で実装
      };

    } catch (error) {
      this.logger.error('Schedule adjustment failed:', error);
      return {
        success: false,
        adjusted_issues: [],
        constraint_violations: [
          {
            type: 'adjustment_error',
            description: `日程調整エラー: ${error.message}`,
            affected_issue_ids: [params.trigger_issue_id || ''],
          },
        ],
        critical_path: null,
      };
    }
  }

  /**
   * 単一Issueの日程調整
   */
  private async adjustSingleIssueSchedule(
    issueId: string,
    issues: ScheduleIssue[],
    dependencies: ScheduleDependency[],
    businessDayConfig: BusinessDayConfig,
  ): Promise<AdjustedIssue | null> {
    const issue = issues.find(i => i.id === issueId);
    if (!issue || !issue.start_date || !issue.end_date) {
      return null;
    }

    // 先行タスクの終了日を取得
    const predecessorDeps = dependencies.filter(d => d.successor_issue_id === issueId);
    if (predecessorDeps.length === 0) {
      return null; // 依存関係がない場合は調整不要
    }

    let latestPredecessorEndDate: Date | null = null;
    for (const dep of predecessorDeps) {
      const predecessor = issues.find(i => i.id === dep.predecessor_issue_id);
      if (predecessor && predecessor.end_date) {
        const predEndDate = new Date(predecessor.end_date);
        if (!latestPredecessorEndDate || predEndDate > latestPredecessorEndDate) {
          latestPredecessorEndDate = predEndDate;
        }
      }
    }

    if (!latestPredecessorEndDate) {
      return null;
    }

    // 営業日計算で次の開始可能日を算出
    const newStartDate = ScheduleCalculatorUtil.calculateEarliestStartForFS(latestPredecessorEndDate, businessDayConfig);
    
    // 現在の開始日と比較
    const currentStartDate = new Date(issue.start_date);
    if (newStartDate <= currentStartDate) {
      return null; // 調整不要
    }

    // 期間を維持して終了日を計算
    const currentEndDate = new Date(issue.end_date);
    const duration = ScheduleCalculatorUtil.calculateBusinessDays(currentStartDate, currentEndDate, businessDayConfig);
    const newEndDate = ScheduleCalculatorUtil.addBusinessDays(newStartDate, duration, businessDayConfig);

    // データベースを更新
    try {
      await this.prisma.issue.update({
        where: { id: issueId },
        data: {
          start_date: newStartDate,
          end_date: newEndDate,
          version: { increment: 1 }, // 楽観的排他制御
        },
      });

      return {
        issue_id: issueId,
        old_start_date: issue.start_date,
        old_end_date: issue.end_date,
        new_start_date: newStartDate,
        new_end_date: newEndDate,
        adjustment_reason: '依存関係制約による自動調整',
      };
    } catch (updateError) {
      this.logger.error(`Failed to update issue ${issueId} schedule:`, updateError);
      return null;
    }
  }

  /**
   * 循環依存チェック
   */
  private async checkCyclicDependency(predecessorId: string, successorId: string): Promise<void> {
    const visited = new Set<string>();
    const path = new Set<string>();

    const hasCycle = async (currentId: string): Promise<boolean> => {
      if (path.has(currentId)) {
        return true; // 循環依存を検出
      }
      if (visited.has(currentId)) {
        return false;
      }

      visited.add(currentId);
      path.add(currentId);

      // 現在のノードから出ている依存関係を検索
      const outgoingDeps = await this.prisma.dependency.findMany({
        where: { predecessor_issue_id: currentId },
        select: { successor_issue_id: true },
      });

      // 新しい依存関係を追加
      if (currentId === predecessorId) {
        outgoingDeps.push({ successor_issue_id: successorId });
      }

      for (const dep of outgoingDeps) {
        if (await hasCycle(dep.successor_issue_id)) {
          return true;
        }
      }

      path.delete(currentId);
      return false;
    };

    if (await hasCycle(predecessorId)) {
      throw new BadRequestException('Cyclic dependency detected');
    }
  }

  /**
   * Issue存在確認
   */
  private async validateIssuesExist(
    projectId: string, 
    predecessorId: string, 
    successorId: string
  ): Promise<void> {
    const [predecessor, successor] = await Promise.all([
      this.prisma.issue.findFirst({
        where: { id: predecessorId, project_id: projectId, is_deleted: false },
      }),
      this.prisma.issue.findFirst({
        where: { id: successorId, project_id: projectId, is_deleted: false },
      }),
    ]);

    if (!predecessor) {
      throw new NotFoundException(`Predecessor issue ${predecessorId} not found`);
    }
    if (!successor) {
      throw new NotFoundException(`Successor issue ${successorId} not found`);
    }
  }

  /**
   * プロジェクトのIssue一覧を取得
   */
  private async getProjectIssues(projectId: string): Promise<ScheduleIssue[]> {
    const issues = await this.prisma.issue.findMany({
      where: { project_id: projectId, is_deleted: false },
      select: {
        id: true,
        title: true,
        start_date: true,
        end_date: true,
        effort_hours: true,
      },
    });

    return issues.map(issue => ({
      id: issue.id,
      title: issue.title,
      start_date: issue.start_date,
      end_date: issue.end_date,
      effort_hours: issue.effort_hours,
    }));
  }

  /**
   * プロジェクトの依存関係一覧を取得
   */
  private async getProjectDependencies(projectId: string): Promise<ScheduleDependency[]> {
    const dependencies = await this.prisma.dependency.findMany({
      where: { project_id: projectId },
      select: {
        id: true,
        predecessor_issue_id: true,
        successor_issue_id: true,
        type: true,
      },
    });

    return dependencies.map(dep => ({
      id: dep.id,
      predecessor_issue_id: dep.predecessor_issue_id,
      successor_issue_id: dep.successor_issue_id,
      type: dep.type,
    }));
  }

  /**
   * トポロジカルソート（依存関係順序）
   */
  private getTopologicalOrder(
    issues: ScheduleIssue[], 
    dependencies: ScheduleDependency[]
  ): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // グラフの初期化
    for (const issue of issues) {
      graph.set(issue.id, []);
      inDegree.set(issue.id, 0);
    }

    // 依存関係を追加
    for (const dep of dependencies) {
      graph.get(dep.predecessor_issue_id)?.push(dep.successor_issue_id);
      inDegree.set(dep.successor_issue_id, (inDegree.get(dep.successor_issue_id) || 0) + 1);
    }

    // トポロジカルソート
    const queue: string[] = [];
    const result: string[] = [];

    // 入次数が0のノードをキューに追加
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      result.push(currentNode);

      // 隣接ノードの入次数を減らす
      for (const neighbor of graph.get(currentNode) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * 営業日設定を取得
   */
  private async getBusinessDayConfig(): Promise<BusinessDayConfig> {
    try {
      const globalSettings = await this.settingsService.getHolidaySettings();
      return {
        weekend_off: globalSettings.weekend_off,
        holiday_dates: globalSettings.holiday_dates,
      };
    } catch (error) {
      this.logger.warn('Failed to get global settings, using defaults:', error);
      return {
        weekend_off: true,
        holiday_dates: [],
      };
    }
  }
}