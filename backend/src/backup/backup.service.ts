import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IssueStatus, DependencyType, ChangeEntityType } from '@prisma/client';
import {
  ProjectExportData,
  ExportMetadata,
  ProjectData,
  IssueData,
  CommentData,
  DependencyData,
  ChangeLogData,
  ImagePathData,
} from './dto/project-export.dto';
import {
  ImportResult,
  ImportValidationResult,
  ImportValidationError,
} from './dto/project-import.dto';
import * as archiver from 'archiver';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Response } from 'express';

@Injectable()
export class BackupService {
  // アップロードされた画像ファイルの保存先ディレクトリ
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  
  // エクスポートファイルの最大サイズ（100MB）
  private readonly MAX_EXPORT_SIZE = 100 * 1024 * 1024;

  constructor(private prisma: PrismaService) {}

  /**
   * プロジェクトをエクスポートしてZIPファイルとしてレスポンスを返す
   */
  async exportProject(projectId: string, response: Response): Promise<void> {
    // プロジェクトの存在確認
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, is_deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // エクスポートデータの収集
    const exportData = await this.collectProjectData(projectId);
    
    // ZIPファイルの作成とストリーミング
    await this.createAndStreamZip(exportData, response);
  }

  /**
   * ZIPファイルからプロジェクトをインポート（シンプルな実装）
   */
  async importProject(zipBuffer: Buffer, projectName?: string): Promise<ImportResult> {
    // ファイルサイズチェック
    if (zipBuffer.length > this.MAX_EXPORT_SIZE) {
      throw new BadRequestException('Import file size exceeds limit (100MB)');
    }

    try {
      // 一時的にJSONファイルのみを受け入れる実装
      // 実際のプロジェクトではZIP処理ライブラリを追加する必要があります
      let exportData: ProjectExportData;
      
      try {
        // ZIPファイルではなく、JSONファイルとして処理する暫定実装
        const jsonContent = zipBuffer.toString('utf8');
        exportData = JSON.parse(jsonContent);
      } catch (parseError) {
        throw new BadRequestException('Invalid file format. Currently only JSON files are supported temporarily.');
      }

      // データの検証
      const validation = this.validateImportData(exportData);
      if (!validation.isValid) {
        throw new BadRequestException(`Invalid import data: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // プロジェクトの作成
      const newProjectId = await this.createProjectFromImport(exportData, projectName);
      
      return {
        success: true,
        projectId: newProjectId,
        message: 'Project imported successfully',
        importedCounts: {
          issues: exportData.issues?.length || 0,
          comments: exportData.comments?.length || 0,
          dependencies: exportData.dependencies?.length || 0,
          changeLogs: exportData.changeLogs?.length || 0,
          images: exportData.imagePaths?.length || 0,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }

  /**
   * インポートデータの検証
   */
  private validateImportData(data: ProjectExportData): ImportValidationResult {
    const errors: ImportValidationError[] = [];
    const warnings: string[] = [];

    // メタデータチェック
    if (!data.metadata) {
      errors.push({ field: 'metadata', message: 'Metadata is required' });
    } else if (!data.metadata.version) {
      errors.push({ field: 'metadata.version', message: 'Version is required' });
    }

    // プロジェクトデータチェック
    if (!data.project) {
      errors.push({ field: 'project', message: 'Project data is required' });
    } else {
      if (!data.project.name || data.project.name.trim().length === 0) {
        errors.push({ field: 'project.name', message: 'Project name is required' });
      }
    }

    // Issuesの検証
    if (data.issues) {
      data.issues.forEach((issue, index) => {
        if (!issue.title || issue.title.trim().length === 0) {
          errors.push({ field: `issues[${index}].title`, message: 'Issue title is required' });
        }
        if (issue.progress_pct < 0 || issue.progress_pct > 100) {
          errors.push({ field: `issues[${index}].progress_pct`, message: 'Progress must be between 0 and 100' });
        }
      });
    }

    // バージョン互換性チェック
    if (data.metadata && data.metadata.version !== '1.0.0') {
      warnings.push(`Version ${data.metadata.version} may not be fully compatible`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * インポートデータからプロジェクトを作成
   */
  private async createProjectFromImport(data: ProjectExportData, customName?: string): Promise<string> {
    return await this.prisma.$transaction(async (prisma) => {
      // 新しいプロジェクトを作成
      const newProject = await prisma.project.create({
        data: {
          name: customName || `${data.project.name} (Imported)`,
          description_md: data.project.description_md,
          is_deleted: false,
        },
      });

      // IDマッピング（元のID → 新しいID）
      const issueIdMapping: { [oldId: string]: string } = {};

      // Issuesを作成（親子関係は後で設定）
      if (data.issues && data.issues.length > 0) {
        const issuesWithoutParent = data.issues.filter(issue => !issue.parent_id);
        const issuesWithParent = data.issues.filter(issue => issue.parent_id);

        // まず親がないIssuesを作成
        for (const issue of issuesWithoutParent) {
          const newIssue = await prisma.issue.create({
            data: {
              project_id: newProject.id,
              parent_id: null,
              title: issue.title,
              description_md: issue.description_md,
              assignee: issue.assignee,
              status: issue.status as IssueStatus,
              start_date: issue.start_date,
              end_date: issue.end_date,
              progress_pct: issue.progress_pct,
              effort_hours: issue.effort_hours,
              is_blocked: issue.is_blocked,
              sort_order: issue.sort_order,
              labels: issue.labels,
              is_deleted: false,
              version: 1, // 新しいバージョンとして作成
            },
          });
          issueIdMapping[issue.id] = newIssue.id;
        }

        // 次に子Issuesを作成
        for (const issue of issuesWithParent) {
          const parentId = issueIdMapping[issue.parent_id!];
          if (parentId) {
            const newIssue = await prisma.issue.create({
              data: {
                project_id: newProject.id,
                parent_id: parentId,
                title: issue.title,
                description_md: issue.description_md,
                assignee: issue.assignee,
                status: issue.status as IssueStatus,
                start_date: issue.start_date,
                end_date: issue.end_date,
                progress_pct: issue.progress_pct,
                effort_hours: issue.effort_hours,
                is_blocked: issue.is_blocked,
                sort_order: issue.sort_order,
                labels: issue.labels,
                is_deleted: false,
                version: 1,
              },
            });
            issueIdMapping[issue.id] = newIssue.id;
          }
        }
      }

      // Comments を作成
      if (data.comments && data.comments.length > 0) {
        for (const comment of data.comments) {
          const newIssueId = issueIdMapping[comment.issue_id];
          if (newIssueId) {
            await prisma.comment.create({
              data: {
                issue_id: newIssueId,
                author: comment.author,
                body_md: comment.body_md,
                edited: comment.edited,
              },
            });
          }
        }
      }

      // Dependencies を作成
      if (data.dependencies && data.dependencies.length > 0) {
        for (const dependency of data.dependencies) {
          const predecessorId = issueIdMapping[dependency.predecessor_issue_id];
          const successorId = issueIdMapping[dependency.successor_issue_id];
          
          if (predecessorId && successorId) {
            await prisma.dependency.create({
              data: {
                project_id: newProject.id,
                predecessor_issue_id: predecessorId,
                successor_issue_id: successorId,
                type: dependency.type as DependencyType,
              },
            });
          }
        }
      }

      // Image paths は一時的にスキップ（ZIPファイル処理が実装されていないため）
      // 実際のプロジェクトでは画像ファイルも処理する必要があります

      // Change logs は元のIDでは意味がないので、インポート記録として1つだけ作成
      await prisma.changeLog.create({
        data: {
          entity_type: ChangeEntityType.Project,
          entity_id: newProject.id,
          project_id: newProject.id,
          diff_json: {
            action: 'import',
            originalProjectId: data.project.id,
            originalProjectName: data.project.name,
            importedAt: new Date().toISOString(),
            importedCounts: {
              issues: data.issues?.length || 0,
              comments: data.comments?.length || 0,
              dependencies: data.dependencies?.length || 0,
              images: 0, // 画像処理は未実装
            },
          },
          user_hint: 'Project imported from backup (JSON format)',
        },
      });

      return newProject.id;
    });
  }

  /**
   * プロジェクトの全データを収集
   */
  private async collectProjectData(projectId: string): Promise<ProjectExportData> {
    // 並列でデータを取得してパフォーマンスを向上
    const [project, issues, comments, dependencies, changeLogs, imagePaths] = await Promise.all([
      this.getProjectData(projectId),
      this.getIssuesData(projectId),
      this.getCommentsData(projectId),
      this.getDependenciesData(projectId),
      this.getChangeLogsData(projectId),
      this.getImagePathsData(projectId),
    ]);

    const metadata: ExportMetadata = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      projectId: project.id,
      projectName: project.name,
    };

    return {
      metadata,
      project,
      issues,
      comments,
      dependencies,
      changeLogs,
      imagePaths,
    };
  }

  /**
   * プロジェクト基本データ取得
   */
  private async getProjectData(projectId: string): Promise<ProjectData> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, is_deleted: false },
      select: {
        id: true,
        name: true,
        description_md: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return project;
  }

  /**
   * Issues データ取得（削除済み除外）
   */
  private async getIssuesData(projectId: string): Promise<IssueData[]> {
    return await this.prisma.issue.findMany({
      where: { project_id: projectId, is_deleted: false },
      select: {
        id: true,
        project_id: true,
        parent_id: true,
        title: true,
        description_md: true,
        assignee: true,
        status: true,
        start_date: true,
        end_date: true,
        progress_pct: true,
        effort_hours: true,
        is_blocked: true,
        sort_order: true,
        labels: true,
        version: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * Comments データ取得
   */
  private async getCommentsData(projectId: string): Promise<CommentData[]> {
    return await this.prisma.comment.findMany({
      where: {
        issue: {
          project_id: projectId,
          is_deleted: false,
        },
      },
      select: {
        id: true,
        issue_id: true,
        author: true,
        body_md: true,
        edited: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Dependencies データ取得
   */
  private async getDependenciesData(projectId: string): Promise<DependencyData[]> {
    return await this.prisma.dependency.findMany({
      where: { project_id: projectId },
      select: {
        id: true,
        project_id: true,
        predecessor_issue_id: true,
        successor_issue_id: true,
        type: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * ChangeLogs データ取得
   */
  private async getChangeLogsData(projectId: string): Promise<ChangeLogData[]> {
    return await this.prisma.changeLog.findMany({
      where: { project_id: projectId },
      select: {
        id: true,
        entity_type: true,
        entity_id: true,
        project_id: true,
        diff_json: true,
        user_hint: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * ImagePaths データ取得
   */
  private async getImagePathsData(projectId: string): Promise<ImagePathData[]> {
    return await this.prisma.imagePath.findMany({
      where: {
        issue: {
          project_id: projectId,
          is_deleted: false,
        },
      },
      select: {
        id: true,
        issue_id: true,
        path: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * ZIPファイルを作成してレスポンスにストリーミング
   */
  private async createAndStreamZip(exportData: ProjectExportData, response: Response): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `project-export-${exportData.project.id}-${timestamp}.zip`;

    // レスポンスヘッダーの設定
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // アーカイバーの初期化
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 最高の圧縮レベル
    });

    // エラーハンドリング
    archive.on('error', (err) => {
      throw err;
    });

    // レスポンスにパイプ
    archive.pipe(response);

    // メタデータの追加
    const metadataJson = JSON.stringify(exportData.metadata, null, 2);
    archive.append(metadataJson, { name: 'metadata.json' });

    // プロジェクトデータの追加
    const dataJson = JSON.stringify(exportData, null, 2);
    archive.append(dataJson, { name: 'data.json' });

    // 画像ファイルの追加
    await this.addImageFiles(archive, exportData.imagePaths);

    // アーカイブの完了
    await archive.finalize();
  }

  /**
   * 画像ファイルをZIPに追加
   */
  private async addImageFiles(archive: archiver.Archiver, imagePaths: ImagePathData[]): Promise<void> {
    for (const imageInfo of imagePaths) {
      const imagePath = path.join(this.UPLOAD_DIR, imageInfo.path);
      
      try {
        // ファイルの存在確認
        const exists = await fs.pathExists(imagePath);
        if (exists) {
          // ファイルサイズの確認
          const stats = await fs.stat(imagePath);
          if (stats.size > 0) {
            // ZIPにファイルを追加
            const readStream = fs.createReadStream(imagePath);
            archive.append(readStream, { name: `images/${imageInfo.path}` });
          }
        }
      } catch (error) {
        // ファイル読み取りエラーはログに記録するが、エクスポート自体は継続
        console.warn(`Failed to add image file: ${imagePath}`, error);
      }
    }
  }
}