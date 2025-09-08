import {
  Controller,
  Post,
  Param,
  Res,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RoleGuard } from '../common/guards/role.guard';
import { ImportResult } from './dto/project-import.dto';

@Controller('api/backup')
@UseGuards(RoleGuard)
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backupService: BackupService) {}

  /**
   * プロジェクトエクスポート実行
   * Editor権限が必要
   */
  @Post('export/:projectId')
  @RequireRole('editor')
  async exportProject(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`Starting project export for projectId: ${projectId}`);

    try {
      // パラメータの検証
      if (!projectId || typeof projectId !== 'string') {
        throw new HttpException(
          'Invalid project ID provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      // プロジェクトIDの形式チェック（CUIDの基本的な検証）
      if (!/^c[a-z0-9]{24}$/i.test(projectId)) {
        throw new HttpException(
          'Invalid project ID format',
          HttpStatus.BAD_REQUEST,
        );
      }

      // エクスポート実行
      await this.backupService.exportProject(projectId, res);
      
      this.logger.log(`Project export completed for projectId: ${projectId}`);
    } catch (error) {
      this.logger.error(
        `Project export failed for projectId: ${projectId}`,
        error,
      );

      // エラーがすでにHTTPExceptionの場合はそのまま投げる
      if (error instanceof HttpException) {
        throw error;
      }

      // ファイルサイズ制限エラー
      if (error.message && error.message.includes('size limit')) {
        throw new HttpException(
          'Export file size exceeds limit (100MB)',
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }

      // その他のエラーは500エラーとして処理
      throw new HttpException(
        'Internal server error during export',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * プロジェクトインポート実行
   * Editor権限が必要
   */
  @Post('import')
  @RequireRole('editor')
  @UseInterceptors(FileInterceptor('file'))
  async importProject(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectName') projectName?: string,
  ): Promise<ImportResult> {
    this.logger.log('Starting project import');

    try {
      // ファイルの存在確認
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // ファイル形式の確認
      if (!file.mimetype || !file.mimetype.includes('zip')) {
        if (!file.originalname || !file.originalname.toLowerCase().endsWith('.zip')) {
          throw new BadRequestException('Only ZIP files are supported');
        }
      }

      // ファイルサイズの確認（100MB制限）
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds limit (100MB)');
      }

      // プロジェクト名の検証（提供された場合）
      if (projectName && projectName.trim().length === 0) {
        throw new BadRequestException('Project name cannot be empty');
      }

      this.logger.log(`Importing file: ${file.originalname}, size: ${file.size} bytes`);

      // インポート実行
      const result = await this.backupService.importProject(
        file.buffer,
        projectName?.trim(),
      );

      this.logger.log(`Project import completed successfully. New project ID: ${result.projectId}`);
      return result;
      
    } catch (error) {
      this.logger.error('Project import failed', error);

      // エラーがすでにHTTPExceptionの場合はそのまま投げる
      if (error instanceof HttpException) {
        throw error;
      }

      // その他のエラーは500エラーとして処理
      throw new HttpException(
        `Import failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}