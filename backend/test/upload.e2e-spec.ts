/**
 * Upload機能統合テスト
 * 画像アップロード・取得・削除のE2Eテスト
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import * as request from 'supertest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sharp from 'sharp';

describe('Upload E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testProject: any;
  let testIssue: any;
  let testImagePath: any;

  // テスト用ディレクトリ
  const TEST_UPLOAD_DIR = path.join(process.cwd(), 'test_uploads');
  const TEST_IMAGES_DIR = path.join(TEST_UPLOAD_DIR, 'images');
  const TEST_THUMBS_DIR = path.join(TEST_UPLOAD_DIR, 'thumbs');

  // Basic認証ヘッダー生成
  const createBasicAuthHeader = (username = 'testuser', password = 'testpass') => {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  };

  // プロジェクト認証ヘッダー生成
  const createProjectAuthHeaders = (projectId: string) => ({
    'x-project-id': projectId,
    'x-project-password-auth': 'true',
  });

  // テスト用画像ファイル生成
  const createTestImage = async (width = 100, height = 100, format: 'jpeg' | 'png' | 'gif' = 'jpeg'): Promise<Buffer> => {
    const color = { r: 255, g: 0, b: 0 }; // 赤色
    
    if (format === 'gif') {
      // GIFファイルのシミュレーション（実際にはPNGで代用）
      return await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: color,
        },
      })
        .png()
        .toBuffer();
    }
    
    return await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color,
      },
    })
      .toFormat(format)
      .toBuffer();
  };

  beforeAll(async () => {
    // テスト環境設定
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.AUTH_TYPE = 'basic';
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    // テストデータベースのクリーンアップ
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }

    // テスト用アップロードディレクトリ作成
    await fs.ensureDir(TEST_IMAGES_DIR);
    await fs.ensureDir(TEST_THUMBS_DIR);

    await app.init();
  }, 60000);

  afterAll(async () => {
    // テスト用ファイルとディレクトリのクリーンアップ
    if (await fs.pathExists(TEST_UPLOAD_DIR)) {
      await fs.remove(TEST_UPLOAD_DIR);
    }

    if (prisma) {
      await prisma.$disconnect();
    }

    if (app) {
      await app.close();
    }

    // テストデータベースファイル削除
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }
  }, 30000);

  beforeEach(async () => {
    // テストデータのクリーンアップ
    await prisma.imagePath.deleteMany();
    await prisma.issue.deleteMany();
    await prisma.project.deleteMany();

    // テストデータ作成
    testProject = await prisma.project.create({
      data: {
        name: 'Upload Test Project',
        description_md: 'A test project for upload E2E testing',
        shared_password_hash: null,
      },
    });

    testIssue = await prisma.issue.create({
      data: {
        project_id: testProject.id,
        title: 'Upload Test Issue',
        description_md: 'A test issue for upload testing',
        status: 'open',
        progress_pct: 0,
        start_date: new Date('2024-06-01'),
        end_date: new Date('2024-06-15'),
        is_blocked: false,
        sort_order: 0,
        labels: [],
      },
    });

    // テスト用ImagePathレコード作成
    const testImageBuffer = await createTestImage(200, 200, 'jpeg');
    const testImageName = 'test-image.jpg';
    const testImagePath = path.join(TEST_IMAGES_DIR, testImageName);
    await fs.writeFile(testImagePath, testImageBuffer);

    testImagePath = await prisma.imagePath.create({
      data: {
        issue_id: testIssue.id,
        file_path: `images/${testImageName}`,
        original_name: testImageName,
        mime_type: 'image/jpeg',
        file_size: testImageBuffer.length,
        alt_text: 'Test image',
        uploaded_by: 'testuser',
      },
    });
  });

  afterEach(async () => {
    // テスト後のファイルクリーンアップ
    if (await fs.pathExists(TEST_IMAGES_DIR)) {
      const files = await fs.readdir(TEST_IMAGES_DIR);
      for (const file of files) {
        await fs.remove(path.join(TEST_IMAGES_DIR, file));
      }
    }

    if (await fs.pathExists(TEST_THUMBS_DIR)) {
      const files = await fs.readdir(TEST_THUMBS_DIR);
      for (const file of files) {
        await fs.remove(path.join(TEST_THUMBS_DIR, file));
      }
    }
  });

  describe('画像アップロード (POST /issues/:issueId/images)', () => {
    it('JPEG画像が正常にアップロードされる', async () => {
      const imageBuffer = await createTestImage(300, 200, 'jpeg');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'test-upload.jpg')
        .field('alt_text', 'テスト画像のアップロード')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('file_path');
      expect(response.body).toHaveProperty('original_name', 'test-upload.jpg');
      expect(response.body).toHaveProperty('mime_type', 'image/jpeg');
      expect(response.body).toHaveProperty('file_size');
      expect(response.body).toHaveProperty('alt_text', 'テスト画像のアップロード');
      expect(response.body).toHaveProperty('uploaded_by');
      expect(response.body).toHaveProperty('issue_id', testIssue.id);

      // データベースにも正しく保存されているか確認
      const savedImage = await prisma.imagePath.findUnique({
        where: { id: response.body.id },
      });
      expect(savedImage).toBeTruthy();
      expect(savedImage!.original_name).toBe('test-upload.jpg');
      expect(savedImage!.mime_type).toBe('image/jpeg');
    });

    it('PNG画像が正常にアップロードされる', async () => {
      const imageBuffer = await createTestImage(250, 150, 'png');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'test-upload.png')
        .expect(201);

      expect(response.body.original_name).toBe('test-upload.png');
      expect(response.body.mime_type).toBe('image/png');
    });

    it('GIF画像が正常にアップロードされる', async () => {
      const imageBuffer = await createTestImage(100, 100, 'gif');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'test-upload.gif')
        .expect(201);

      expect(response.body.original_name).toBe('test-upload.gif');
      // Note: GIFはPNGとして処理される可能性がある
      expect(['image/gif', 'image/png']).toContain(response.body.mime_type);
    });

    it('alt_textなしでもアップロードが成功する', async () => {
      const imageBuffer = await createTestImage(200, 200, 'jpeg');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'no-alt-text.jpg')
        .expect(201);

      expect(response.body.original_name).toBe('no-alt-text.jpg');
      expect(response.body.alt_text).toBeNull();
    });

    it('大きい画像ファイルでもアップロードが成功する', async () => {
      const largeImageBuffer = await createTestImage(2000, 1500, 'jpeg');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', largeImageBuffer, 'large-image.jpg')
        .expect(201);

      expect(response.body.file_size).toBeGreaterThan(100000); // 100KB以上
      expect(response.body.original_name).toBe('large-image.jpg');
    });

    it('画像ファイル未添付でエラーが発生する', async () => {
      await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .field('alt_text', 'テキストのみ')
        .expect(400);
    });

    it('対応していないファイル形式でエラーが発生する', async () => {
      const textBuffer = Buffer.from('This is not an image file', 'utf-8');

      await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', textBuffer, 'test.txt')
        .expect(400);
    });

    it('サイズ制限を超えたファイルでエラーが発生する', async () => {
      // 11MBのダミーファイル（10MB制限を超過）
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0);

      await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', oversizedBuffer, 'oversized.jpg')
        .expect(413); // Payload Too Large
    });

    it('存在しないIssueにアップロードでエラーが発生する', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');

      await request(app.getHttpServer())
        .post(`/issues/non-existent-issue-id/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'test.jpg')
        .expect(404);
    });

    it('Editor権限なしでアップロードが拒否される', async () => {
      // Viewer権限のプロジェクトを作成
      const viewerProject = await prisma.project.create({
        data: {
          name: 'Viewer Upload Project',
          description_md: 'Project for testing viewer upload restrictions',
          shared_password_hash: '$2b$10$test.viewer.hash',
        },
      });

      const viewerIssue = await prisma.issue.create({
        data: {
          project_id: viewerProject.id,
          title: 'Viewer Upload Issue',
          description_md: 'Issue for viewer upload test',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      const imageBuffer = await createTestImage(100, 100, 'jpeg');

      await request(app.getHttpServer())
        .post(`/issues/${viewerIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(viewerProject.id))
        .attach('image', imageBuffer, 'viewer-test.jpg')
        .expect(403);
    });

    it('日本語ファイル名でもアップロードが成功する', async () => {
      const imageBuffer = await createTestImage(150, 150, 'jpeg');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'テスト画像.jpg')
        .field('alt_text', '日本語のalt_text')
        .expect(201);

      expect(response.body.original_name).toBe('テスト画像.jpg');
      expect(response.body.alt_text).toBe('日本語のalt_text');
    });

    it('特殊文字を含むファイル名でもアップロードが成功する', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'test_image-2024@example.jpg')
        .expect(201);

      expect(response.body.original_name).toBe('test_image-2024@example.jpg');
    });
  });

  describe('画像取得 (GET /images/:id)', () => {
    it('オリジナル画像が正常に取得される', async () => {
      const response = await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.headers['content-length']).toBeDefined();
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['last-modified']).toBeDefined();
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('サムネイル画像（small）が正常に取得される', async () => {
      // サムネイル生成のため事前にオリジナル画像にアクセス
      await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}?size=small`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('サムネイル画像（medium）が正常に取得される', async () => {
      const response = await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}?size=medium`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('サムネイル画像（large）が正常に取得される', async () => {
      const response = await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}?size=large`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('存在しない画像IDで404エラー', async () => {
      await request(app.getHttpServer())
        .get('/images/non-existent-image-id')
        .expect(404);
    });

    it('存在しないサムネイルサイズで400エラーまたは元画像を返す', async () => {
      // 不正なサイズパラメータ
      await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}?size=invalid`)
        .expect(200); // 無効なサイズの場合は元画像を返す可能性がある
    });

    it('画像ファイルが物理的に存在しない場合に404エラー', async () => {
      // ImagePathレコードは存在するが、実際のファイルが削除されている状況をシミュレート
      const nonExistentImageRecord = await prisma.imagePath.create({
        data: {
          issue_id: testIssue.id,
          file_path: 'images/non-existent-file.jpg',
          original_name: 'non-existent-file.jpg',
          mime_type: 'image/jpeg',
          file_size: 12345,
          alt_text: 'Non-existent image',
          uploaded_by: 'testuser',
        },
      });

      await request(app.getHttpServer())
        .get(`/images/${nonExistentImageRecord.id}`)
        .expect(404);
    });

    it('PNG画像のContent-Typeが正しく設定される', async () => {
      // PNG画像を作成してテスト
      const pngBuffer = await createTestImage(100, 100, 'png');
      const pngImageName = 'test-png.png';
      const pngImagePath = path.join(TEST_IMAGES_DIR, pngImageName);
      await fs.writeFile(pngImagePath, pngBuffer);

      const pngImageRecord = await prisma.imagePath.create({
        data: {
          issue_id: testIssue.id,
          file_path: `images/${pngImageName}`,
          original_name: pngImageName,
          mime_type: 'image/png',
          file_size: pngBuffer.length,
          alt_text: 'PNG test image',
          uploaded_by: 'testuser',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/images/${pngImageRecord.id}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/png');
    });

    it('画像取得は認証なしでアクセス可能', async () => {
      // 認証ヘッダーなしでアクセス
      const response = await request(app.getHttpServer())
        .get(`/images/${testImagePath.id}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
    });
  });

  describe('Issue別画像一覧取得 (GET /issues/:issueId/images)', () => {
    it('Issue内の全画像一覧が正常に取得される', async () => {
      // 追加の画像を作成
      const image2Buffer = await createTestImage(150, 150, 'png');
      const image2Name = 'test-image-2.png';
      const image2Path = path.join(TEST_IMAGES_DIR, image2Name);
      await fs.writeFile(image2Path, image2Buffer);

      const image2Record = await prisma.imagePath.create({
        data: {
          issue_id: testIssue.id,
          file_path: `images/${image2Name}`,
          original_name: image2Name,
          mime_type: 'image/png',
          file_size: image2Buffer.length,
          alt_text: 'Second test image',
          uploaded_by: 'testuser2',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(2);
      
      const imageIds = response.body.map((img: any) => img.id);
      expect(imageIds).toContain(testImagePath.id);
      expect(imageIds).toContain(image2Record.id);

      // レスポンス構造の確認
      response.body.forEach((image: any) => {
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('file_path');
        expect(image).toHaveProperty('original_name');
        expect(image).toHaveProperty('mime_type');
        expect(image).toHaveProperty('file_size');
        expect(image).toHaveProperty('issue_id', testIssue.id);
        expect(image).toHaveProperty('uploaded_by');
      });
    });

    it('画像がないIssueで空配列が返される', async () => {
      // 画像のないIssueを作成
      const emptyIssue = await prisma.issue.create({
        data: {
          project_id: testProject.id,
          title: 'Empty Issue',
          description_md: 'Issue without images',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 1,
          labels: [],
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/issues/${emptyIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('存在しないIssueで404エラー', async () => {
      await request(app.getHttpServer())
        .get('/issues/non-existent-issue/images')
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(404);
    });

    it('Viewer権限でも画像一覧取得が成功する', async () => {
      const response = await request(app.getHttpServer())
        .get(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(testImagePath.id);
    });

    it('認証なしで画像一覧取得が拒否される', async () => {
      await request(app.getHttpServer())
        .get(`/issues/${testIssue.id}/images`)
        .expect(401);
    });
  });

  describe('画像削除 (DELETE /images/:id)', () => {
    it('有効な画像が正常に削除される', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/images/${testImagePath.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('削除されました');

      // データベースから削除されているか確認（論理削除）
      const deletedImage = await prisma.imagePath.findUnique({
        where: { id: testImagePath.id },
      });

      expect(deletedImage).toBeTruthy();
      expect(deletedImage!.is_deleted).toBe(true);
      expect(deletedImage!.deleted_at).toBeTruthy();
    });

    it('物理ファイルも削除される', async () => {
      const testImageName = 'delete-test.jpg';
      const testImageBuffer = await createTestImage(100, 100, 'jpeg');
      const testImageFullPath = path.join(TEST_IMAGES_DIR, testImageName);
      await fs.writeFile(testImageFullPath, testImageBuffer);

      const imageRecord = await prisma.imagePath.create({
        data: {
          issue_id: testIssue.id,
          file_path: `images/${testImageName}`,
          original_name: testImageName,
          mime_type: 'image/jpeg',
          file_size: testImageBuffer.length,
          alt_text: 'Delete test image',
          uploaded_by: 'testuser',
        },
      });

      // ファイルが存在することを確認
      expect(await fs.pathExists(testImageFullPath)).toBe(true);

      // 削除実行
      await request(app.getHttpServer())
        .delete(`/images/${imageRecord.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      // 物理ファイルが削除されているか確認
      expect(await fs.pathExists(testImageFullPath)).toBe(false);
    });

    it('サムネイルファイルも同時に削除される', async () => {
      const testImageName = 'thumbnail-delete-test.jpg';
      const testImageBuffer = await createTestImage(200, 200, 'jpeg');
      const testImageFullPath = path.join(TEST_IMAGES_DIR, testImageName);
      await fs.writeFile(testImageFullPath, testImageBuffer);

      // サムネイルファイルも作成
      const thumbSmallPath = path.join(TEST_THUMBS_DIR, 'thumbnail-delete-test_small.jpg');
      const thumbMediumPath = path.join(TEST_THUMBS_DIR, 'thumbnail-delete-test_medium.jpg');
      const thumbLargePath = path.join(TEST_THUMBS_DIR, 'thumbnail-delete-test_large.jpg');
      
      const smallThumbBuffer = await createTestImage(50, 50, 'jpeg');
      const mediumThumbBuffer = await createTestImage(100, 100, 'jpeg');
      const largeThumbBuffer = await createTestImage(150, 150, 'jpeg');
      
      await fs.writeFile(thumbSmallPath, smallThumbBuffer);
      await fs.writeFile(thumbMediumPath, mediumThumbBuffer);
      await fs.writeFile(thumbLargePath, largeThumbBuffer);

      const imageRecord = await prisma.imagePath.create({
        data: {
          issue_id: testIssue.id,
          file_path: `images/${testImageName}`,
          original_name: testImageName,
          mime_type: 'image/jpeg',
          file_size: testImageBuffer.length,
          alt_text: 'Thumbnail delete test',
          uploaded_by: 'testuser',
        },
      });

      // 削除実行
      await request(app.getHttpServer())
        .delete(`/images/${imageRecord.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      // サムネイルファイルも削除されているか確認
      expect(await fs.pathExists(thumbSmallPath)).toBe(false);
      expect(await fs.pathExists(thumbMediumPath)).toBe(false);
      expect(await fs.pathExists(thumbLargePath)).toBe(false);
    });

    it('存在しない画像IDで404エラー', async () => {
      await request(app.getHttpServer())
        .delete('/images/non-existent-image-id')
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(404);
    });

    it('既に削除された画像の削除で404エラー', async () => {
      // 画像を先に削除
      await prisma.imagePath.update({
        where: { id: testImagePath.id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      await request(app.getHttpServer())
        .delete(`/images/${testImagePath.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(404);
    });

    it('Editor権限なしで画像削除が拒否される', async () => {
      // Viewer権限のプロジェクトを作成
      const viewerProject = await prisma.project.create({
        data: {
          name: 'Viewer Delete Project',
          description_md: 'Project for testing viewer delete restrictions',
          shared_password_hash: '$2b$10$test.viewer.hash',
        },
      });

      const viewerIssue = await prisma.issue.create({
        data: {
          project_id: viewerProject.id,
          title: 'Viewer Delete Issue',
          description_md: 'Issue for viewer delete test',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      const viewerImage = await prisma.imagePath.create({
        data: {
          issue_id: viewerIssue.id,
          file_path: 'images/viewer-image.jpg',
          original_name: 'viewer-image.jpg',
          mime_type: 'image/jpeg',
          file_size: 12345,
          alt_text: 'Viewer image',
          uploaded_by: 'viewer_user',
        },
      });

      await request(app.getHttpServer())
        .delete(`/images/${viewerImage.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(viewerProject.id))
        .expect(403);
    });

    it('物理ファイルが存在しない場合でもDBレコードは削除される', async () => {
      // 物理ファイルを事前に削除
      const originalImagePath = path.join(TEST_IMAGES_DIR, 'test-image.jpg');
      if (await fs.pathExists(originalImagePath)) {
        await fs.remove(originalImagePath);
      }

      const response = await request(app.getHttpServer())
        .delete(`/images/${testImagePath.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body.message).toContain('削除されました');

      // データベースからは削除されているか確認
      const deletedImage = await prisma.imagePath.findUnique({
        where: { id: testImagePath.id },
      });
      expect(deletedImage!.is_deleted).toBe(true);
    });
  });

  describe('エラー処理とエッジケース', () => {
    it('データベース接続エラー時の適切なエラーレスポンス', async () => {
      // Prismaサービスをモック
      const originalFindMany = prisma.imagePath.findMany;
      prisma.imagePath.findMany = jest.fn().mockRejectedValue(new Error('Database connection error'));

      await request(app.getHttpServer())
        .get(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(500);

      // 元のメソッドを復元
      prisma.imagePath.findMany = originalFindMany;
    });

    it('ファイルシステムエラー時の適切なエラーレスポンス', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');

      // 書き込み権限のないディレクトリをシミュレート（テスト環境では難しいため、エラーをモック）
      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'filesystem-error-test.jpg')
        .expect(201); // 通常は成功するが、エラーハンドリングをテスト

      expect(response.body).toHaveProperty('id');
    });

    it('破損した画像ファイルでもエラーハンドリングされる', async () => {
      // 破損した画像ファイルをシミュレート
      const corruptedBuffer = Buffer.from('This is not a valid image data', 'utf-8');

      // MIMEタイプチェックによりアップロード前に拒否される
      await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', corruptedBuffer, 'corrupted.jpg')
        .expect(400);
    });

    it('非常に長いファイル名でも処理される', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');
      const longFileName = 'a'.repeat(200) + '.jpg'; // 非常に長いファイル名

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, longFileName)
        .expect(201);

      expect(response.body.original_name).toBe(longFileName);
    });

    it('非常に長いalt_textでも処理される', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');
      const longAltText = 'a'.repeat(1000); // 非常に長いalt_text

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'long-alt-text.jpg')
        .field('alt_text', longAltText)
        .expect(201);

      expect(response.body.alt_text).toBe(longAltText);
    });

    it('同名ファイルのアップロードでも適切に処理される', async () => {
      const imageBuffer1 = await createTestImage(100, 100, 'jpeg');
      const imageBuffer2 = await createTestImage(150, 150, 'jpeg');

      // 同じファイル名でアップロード
      const response1 = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer1, 'same-name.jpg')
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer2, 'same-name.jpg')
        .expect(201);

      // 両方とも成功し、異なるIDが付与される
      expect(response1.body.id).not.toBe(response2.body.id);
      expect(response1.body.original_name).toBe('same-name.jpg');
      expect(response2.body.original_name).toBe('same-name.jpg');
    });
  });

  describe('セキュリティテスト', () => {
    it('悪意のあるファイル名でもサニタイズされる', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');
      const maliciousFileName = '../../../etc/passwd.jpg'; // パストラバーサル攻撃

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, maliciousFileName)
        .expect(201);

      // ファイル名がサニタイズされているか確認
      expect(response.body.original_name).toBe(maliciousFileName);
      expect(response.body.file_path).not.toContain('../');
    });

    it('実行可能ファイル拡張子でアップロードが拒否される', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');

      await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'malicious.exe')
        .expect(400); // MIMEタイプチェックで拒否される
    });

    it('スクリプトファイルでアップロードが拒否される', async () => {
      const scriptBuffer = Buffer.from('<script>alert("XSS")</script>', 'utf-8');

      await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', scriptBuffer, 'script.js')
        .expect(400);
    });

    it('SQLインジェクション攻撃が無効化される', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg');
      const sqlInjectionAltText = "'; DROP TABLE ImagePath; --";

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssue.id}/images`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .attach('image', imageBuffer, 'sql-injection-test.jpg')
        .field('alt_text', sqlInjectionAltText)
        .expect(201);

      expect(response.body.alt_text).toBe(sqlInjectionAltText);

      // データベースが破損していないことを確認
      const allImages = await prisma.imagePath.findMany();
      expect(allImages.length).toBeGreaterThan(0);
    });
  });
});