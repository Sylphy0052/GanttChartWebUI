import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpStatus,
  HttpCode,
  Res,
  Logger,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { UploadResponseDto, CreateImageUploadDto } from './dto';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * UploadsController - 画像アップロードREST API
 * 
 * エンドポイント:
 * - POST /issues/:issueId/images - 画像アップロード [Editor権限]
 * - GET /images/:id - 画像取得（オリジナル・サムネイル対応）
 * - DELETE /images/:id - 画像削除 [Editor権限]
 * 
 * 機能:
 * - Multerを使用したファイルアップロード処理
 * - サムネイル自動生成（small/medium/large）
 * - 適切なContent-Type設定による画像配信
 * - Editor権限による書き込み制御
 * - ファイルセキュリティ検証（MIME type、サイズ制限）
 * 
 * セキュリティ:
 * - アップロード：Editor権限必須
 * - 削除：Editor権限必須
 * - 取得：権限制限なし（パブリック）
 */
@Controller()
@UseGuards(RoleGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  // 画像保存の基本設定
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  private readonly IMAGES_DIR = path.join(this.UPLOAD_DIR, 'images');
  private readonly THUMBS_DIR = path.join(this.UPLOAD_DIR, 'thumbs');

  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * 画像アップロード
   * @param issueId 関連するIssueID
   * @param file アップロードファイル（Multer経由）
   * @param createImageUploadDto 追加メタデータ
   * @returns アップロード結果
   */
  @Post('issues/:issueId/images')
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('editor')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB制限
      },
      fileFilter: (_req, file, callback) => {
        // MIME typeによるファイル種別制限
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('対応していないファイル形式です。JPEG、PNG、GIFのみ対応しています'),
            false,
          );
        }
      },
    }),
  )
  async uploadImage(
    @Param('issueId') issueId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() createImageUploadDto?: CreateImageUploadDto,
  ): Promise<UploadResponseDto> {
    this.logger.log(`POST /issues/${issueId}/images - Uploading image: ${file?.originalname || 'unknown'}`);

    if (!file) {
      throw new BadRequestException('画像ファイルが選択されていません');
    }

    try {
      const result = await this.uploadsService.uploadImage(
        issueId,
        file,
        createImageUploadDto?.alt_text,
      );

      this.logger.log(`POST /issues/${issueId}/images - Image uploaded successfully: ${result.id}`);
      return result;
    } catch (error: any) {
      this.logger.error(`POST /issues/${issueId}/images - Upload failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 画像取得（オリジナル・サムネイル対応）
   * @param id ImagePathID
   * @param res Express Response
   * @param size サムネイルサイズ（small/medium/large、指定なしでオリジナル）
   */
  @Get('images/:id')
  @HttpCode(HttpStatus.OK)
  // 画像取得は権限制限なし（パブリックアクセス可能）
  async getImage(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('size') size?: 'small' | 'medium' | 'large',
  ): Promise<void> {
    this.logger.log(`GET /images/${id}${size ? `?size=${size}` : ''} - Serving image`);

    try {
      // ImagePathレコードの存在確認
      const imageInfo = await this.uploadsService.getImageById(id);
      
      let filePath: string;
      
      if (size) {
        // サムネイル取得
        const baseName = path.parse(imageInfo.file_path).name.replace('images/', '');
        const ext = path.parse(imageInfo.file_path).ext;
        const thumbFileName = `${baseName}_${size}${ext}`;
        filePath = path.join(this.THUMBS_DIR, thumbFileName);
        
        this.logger.log(`GET /images/${id}?size=${size} - Serving thumbnail: ${thumbFileName}`);
      } else {
        // オリジナル画像取得
        const fileName = imageInfo.file_path.replace('images/', '');
        filePath = path.join(this.IMAGES_DIR, fileName);
        
        this.logger.log(`GET /images/${id} - Serving original image: ${fileName}`);
      }

      // ファイルの存在確認
      if (!(await fs.pathExists(filePath))) {
        this.logger.warn(`GET /images/${id} - File not found: ${filePath}`);
        res.status(HttpStatus.NOT_FOUND).json({
          message: '指定された画像ファイルが見つかりません',
          statusCode: HttpStatus.NOT_FOUND,
        });
        return;
      }

      // Content-Typeの設定（拡張子ベース）
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        default:
          this.logger.warn(`GET /images/${id} - Unknown image format: ${ext}`);
      }

      // ファイル情報の取得
      const stats = await fs.stat(filePath);
      
      // レスポンスヘッダーの設定
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1日キャッシュ
      res.setHeader('Last-Modified', stats.mtime.toUTCString());

      // ファイルストリームの送信
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      this.logger.log(`GET /images/${id} - Image served successfully (${contentType}, ${stats.size} bytes)`);

    } catch (error: any) {
      this.logger.error(`GET /images/${id} - Failed to serve image: ${error.message}`, error);
      
      if (error.status === HttpStatus.NOT_FOUND) {
        res.status(HttpStatus.NOT_FOUND).json({
          message: error.message,
          statusCode: HttpStatus.NOT_FOUND,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: '画像の取得に失敗しました',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    }
  }

  /**
   * 画像削除（物理ファイル＋DBレコード）
   * @param id ImagePathID
   * @returns 削除結果
   */
  @Delete('images/:id')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async deleteImage(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`DELETE /images/${id} - Deleting image`);

    try {
      const result = await this.uploadsService.deleteImage(id);
      
      this.logger.log(`DELETE /images/${id} - Image deleted successfully`);
      return result;
    } catch (error: any) {
      this.logger.error(`DELETE /images/${id} - Delete failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue別画像一覧取得（管理用エンドポイント）
   * @param issueId IssueID
   * @returns Issue内の全画像一覧
   */
  @Get('issues/:issueId/images')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async getImagesByIssue(@Param('issueId') issueId: string): Promise<UploadResponseDto[]> {
    this.logger.log(`GET /issues/${issueId}/images - Fetching images for issue`);

    try {
      const result = await this.uploadsService.getImagesByIssue(issueId);
      
      this.logger.log(`GET /issues/${issueId}/images - Returned ${result.length} images`);
      return result;
    } catch (error: any) {
      this.logger.error(`GET /issues/${issueId}/images - Failed: ${error.message}`, error);
      throw error;
    }
  }
}