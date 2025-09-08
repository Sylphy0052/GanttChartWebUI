import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import * as sharp from 'sharp';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * UploadsService - 画像アップロード管理のビジネスロジック
 * 
 * 機能:
 * - 画像ファイルのアップロード処理
 * - Sharpを使用したサムネイル生成
 * - ImagePathレコードの作成・管理
 * - ファイル保存ディレクトリ管理
 * - セキュリティ検証（ファイルタイプ、サイズ制限）
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  
  // 画像保存の基本設定
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  private readonly IMAGES_DIR = path.join(this.UPLOAD_DIR, 'images');
  private readonly THUMBS_DIR = path.join(this.UPLOAD_DIR, 'thumbs');
  
  // セキュリティ設定
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
  private readonly ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
  
  // サムネイルサイズ定義
  private readonly THUMBNAIL_SIZES = {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 },
  };

  constructor(private readonly prisma: PrismaService) {
    this.initializeDirectories();
  }

  /**
   * アップロードディレクトリの初期化
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.ensureDir(this.UPLOAD_DIR);
      await fs.ensureDir(this.IMAGES_DIR);
      await fs.ensureDir(this.THUMBS_DIR);
      this.logger.log('Upload directories initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize upload directories:', error);
      throw error;
    }
  }

  /**
   * 画像ファイルのアップロードとサムネイル生成
   * @param issueId 関連するIssueID
   * @param file アップロードされたファイル
   * @param altText 代替テキスト（オプション）
   * @returns UploadResponseDto
   * @throws NotFoundException IssueIDが存在しない場合
   * @throws BadRequestException ファイル検証エラー
   */
  async uploadImage(
    issueId: string,
    file: Express.Multer.File,
    altText?: string,
  ): Promise<UploadResponseDto> {
    this.logger.log(`Uploading image for issue: ${issueId}, file: ${file.originalname}`);

    try {
      // Issueの存在確認
      await this.validateIssueExists(issueId);
      
      // ファイル検証
      this.validateFile(file);

      // ファイル保存パスの生成
      const fileName = this.generateUniqueFileName(file.originalname);
      const imagePath = path.join(this.IMAGES_DIR, fileName);
      
      // 元画像の保存
      await fs.writeFile(imagePath, file.buffer);
      
      // 画像メタデータの取得
      const metadata = await this.extractImageMetadata(file.buffer);
      
      // サムネイル生成
      const thumbnails = await this.generateThumbnails(fileName, file.buffer);

      // ImagePathレコードの作成（現在のスキーマに合わせて調整）
      const imagePath_record = await this.prisma.imagePath.create({
        data: {
          issue_id: issueId,
          path: fileName, // 現在のスキーマではpath フィールド
        },
      });

      this.logger.log(`Image uploaded successfully: ${imagePath_record.id}`);

      // レスポンスDTOの構築（現在のスキーマに合わせて調整）
      return {
        id: imagePath_record.id,
        issue_id: imagePath_record.issue_id,
        file_path: `images/${imagePath_record.path}`, // pathを file_pathとして返す
        alt_text: altText || null, // 現在のスキーマには存在しないが、レスポンスでは含める
        uploaded_at: imagePath_record.created_at, // created_atをuploaded_atとして返す
        thumbnails,
        metadata,
      };

    } catch (error) {
      this.logger.error(`Failed to upload image for issue ${issueId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue別画像一覧取得
   * @param issueId IssueID
   * @returns 画像一覧
   * @throws NotFoundException Issueが存在しない場合
   */
  async getImagesByIssue(issueId: string): Promise<UploadResponseDto[]> {
    this.logger.log(`Getting images for issue: ${issueId}`);

    try {
      // Issueの存在確認
      await this.validateIssueExists(issueId);

      const imagePaths = await this.prisma.imagePath.findMany({
        where: {
          issue_id: issueId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      this.logger.log(`Found ${imagePaths.length} images for issue: ${issueId}`);

      return imagePaths.map(imagePath => ({
        id: imagePath.id,
        issue_id: imagePath.issue_id,
        file_path: `images/${imagePath.path}`,
        alt_text: null, // 現在のスキーマには存在しない
        uploaded_at: imagePath.created_at,
      }));

    } catch (error) {
      this.logger.error(`Failed to get images for issue ${issueId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 単一画像情報取得
   * @param id ImagePathID
   * @returns 画像情報
   * @throws NotFoundException 画像が存在しない場合
   */
  async getImageById(id: string): Promise<UploadResponseDto> {
    this.logger.log(`Getting image by id: ${id}`);

    try {
      const imagePath = await this.prisma.imagePath.findUnique({
        where: {
          id,
        },
      });

      if (!imagePath) {
        throw new NotFoundException('指定された画像が見つかりません');
      }

      return {
        id: imagePath.id,
        issue_id: imagePath.issue_id,
        file_path: `images/${imagePath.path}`,
        alt_text: null,
        uploaded_at: imagePath.created_at,
      };

    } catch (error) {
      this.logger.error(`Failed to get image ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 画像削除（物理ファイル+DBレコード）
   * @param id ImagePathID
   * @returns 削除結果メッセージ
   * @throws NotFoundException 画像が存在しない場合
   */
  async deleteImage(id: string): Promise<{ message: string }> {
    this.logger.log(`Deleting image: ${id}`);

    try {
      const imagePath = await this.prisma.imagePath.findUnique({
        where: {
          id,
        },
      });

      if (!imagePath) {
        throw new NotFoundException('指定された画像が見つかりません');
      }

      // 物理ファイルの削除
      const fullPath = path.join(this.IMAGES_DIR, imagePath.path);
      if (await fs.pathExists(fullPath)) {
        await fs.remove(fullPath);
      }

      // サムネイルファイルの削除
      await this.deleteThumbnails(imagePath.path);

      // DBレコードの物理削除（現在のスキーマには論理削除フィールドがない）
      await this.prisma.imagePath.delete({
        where: { id },
      });

      this.logger.log(`Image deleted successfully: ${id}`);
      return { message: '画像が正常に削除されました' };

    } catch (error) {
      this.logger.error(`Failed to delete image ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issueの存在確認
   * @param issueId IssueID
   * @throws NotFoundException Issueが存在しない場合
   */
  private async validateIssueExists(issueId: string): Promise<void> {
    const issue = await this.prisma.issue.findFirst({
      where: {
        id: issueId,
        is_deleted: false,
      },
    });

    if (!issue) {
      throw new NotFoundException('指定されたIssueが見つかりません');
    }
  }

  /**
   * ファイル検証（MIME type、サイズ、拡張子）
   * @param file アップロードファイル
   * @throws BadRequestException 検証エラー
   */
  private validateFile(file: Express.Multer.File): void {
    // ファイルサイズチェック
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('ファイルサイズが10MBを超えています');
    }

    // MIME typeチェック
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('対応していないファイル形式です。JPEG、PNG、GIFのみ対応しています');
    }

    // 拡張子チェック
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('対応していないファイル拡張子です');
    }
  }

  /**
   * ユニークなファイル名の生成
   * @param originalName 元のファイル名
   * @returns ユニークなファイル名
   */
  private generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName);
    return `${timestamp}-${random}${ext}`;
  }

  /**
   * 画像メタデータの抽出
   * @param buffer 画像バッファ
   * @returns メタデータ
   */
  private async extractImageMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
    };
  }

  /**
   * サムネイル生成
   * @param fileName ファイル名
   * @param buffer 画像バッファ
   * @returns サムネイルパス情報
   */
  private async generateThumbnails(fileName: string, buffer: Buffer): Promise<{
    small: string;
    medium: string;
    large: string;
  }> {
    const image = sharp(buffer);
    const baseName = path.parse(fileName).name;
    const ext = path.parse(fileName).ext;

    const thumbnails = {
      small: '',
      medium: '',
      large: '',
    };

    for (const [size, dimensions] of Object.entries(this.THUMBNAIL_SIZES)) {
      const thumbFileName = `${baseName}_${size}${ext}`;
      const thumbPath = path.join(this.THUMBS_DIR, thumbFileName);

      await image
        .resize(dimensions.width, dimensions.height, {
          fit: 'cover',
          position: 'center',
        })
        .toFile(thumbPath);

      thumbnails[size as keyof typeof thumbnails] = `thumbs/${thumbFileName}`;
    }

    return thumbnails;
  }

  /**
   * サムネイルファイルの削除
   * @param fileName 元ファイル名
   */
  private async deleteThumbnails(fileName: string): Promise<void> {
    const baseName = path.parse(fileName).name;
    const ext = path.parse(fileName).ext;

    for (const size of Object.keys(this.THUMBNAIL_SIZES)) {
      const thumbFileName = `${baseName}_${size}${ext}`;
      const thumbPath = path.join(this.THUMBS_DIR, thumbFileName);
      
      if (await fs.pathExists(thumbPath)) {
        await fs.remove(thumbPath);
      }
    }
  }
}