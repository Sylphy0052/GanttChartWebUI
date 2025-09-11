import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * セキュリティテスト: ファイルアップロードの脆弱性検証
 * 
 * 対象攻撃ベクター:
 * 1. 悪意のある実行可能ファイルのアップロード
 * 2. 巨大ファイルによるDoS攻撃
 * 3. 不正なMIMEタイプでのアップロード
 * 4. パストラバーサル攻撃
 * 5. 画像ファイル内のマルウェア
 * 6. ファイル名での攻撃（XSS、コマンドインジェクション）
 * 7. 重複アップロードによるストレージ攻撃
 */
describe('File Upload Security Tests (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  
  // テスト用プロジェクト・Issue データ
  let testProjectId: string;
  let testIssueId: string;
  let validPassword: string;
  let authHeader: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // テスト用プロジェクト作成
    validPassword = 'TestSecurePassword123!';
    const hashedPassword = await bcrypt.hash(validPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'File Upload Security Test Project',
        description: 'Project for file upload security testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${validPassword}`);

    // テスト用Issue作成
    const testIssue = await prismaService.issue.create({
      data: {
        title: 'Test Issue for File Upload',
        description: 'Test description',
        status: 'open',
        priority: 'medium',
        project_id: testProjectId,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
      },
    });
    
    testIssueId = testIssue.id;
  });

  afterAll(async () => {
    // アップロードされたテストファイルをクリーンアップ
    try {
      const uploadedFiles = await prismaService.imagePath.findMany({
        where: { issue_id: testIssueId },
      });

      for (const file of uploadedFiles) {
        const filePath = path.join(process.cwd(), 'uploads', file.file_name);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        const thumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', file.file_name);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }
    } catch (error) {
      console.warn('File cleanup error:', error);
    }

    // テストデータクリーンアップ
    await prismaService.imagePath.deleteMany({
      where: { issue_id: testIssueId },
    });
    await prismaService.issue.deleteMany({
      where: { project_id: testProjectId },
    });
    await prismaService.project.deleteMany({
      where: { name: 'File Upload Security Test Project' },
    });
    
    await app.close();
  });

  describe('1. 悪意のある実行可能ファイル防御', () => {
    const maliciousExecutables = [
      { name: 'malware.exe', content: 'MZ\x90\x00', mimetype: 'application/octet-stream', description: 'Windows実行ファイル' },
      { name: 'script.sh', content: '#!/bin/bash\necho "malicious"', mimetype: 'application/x-sh', description: 'シェルスクリプト' },
      { name: 'malware.bat', content: '@echo off\necho malicious', mimetype: 'application/bat', description: 'バッチファイル' },
      { name: 'virus.com', content: 'malicious binary', mimetype: 'application/octet-stream', description: 'COMファイル' },
      { name: 'trojan.scr', content: 'screen saver trojan', mimetype: 'application/octet-stream', description: 'スクリーンセーバー' },
      { name: 'malware.msi', content: 'MSI installer', mimetype: 'application/x-msi', description: 'MSIインストーラー' },
      { name: 'backdoor.dll', content: 'DLL backdoor', mimetype: 'application/octet-stream', description: 'DLLファイル' },
      { name: 'keylogger.jar', content: 'PK\x03\x04', mimetype: 'application/java-archive', description: 'JARファイル' },
    ];

    maliciousExecutables.forEach(executable => {
      it(`should reject ${executable.description} upload (${executable.name})`, async () => {
        const response = await request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .attach('image', Buffer.from(executable.content), executable.name);

        // 実行可能ファイルが拒否されることを確認
        expect([HttpStatus.BAD_REQUEST, HttpStatus.UNSUPPORTED_MEDIA_TYPE]).toContain(response.status);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/not allowed|unsupported|invalid/i);
      });
    });
  });

  describe('2. 不正なMIMEタイプ攻撃防御', () => {
    const mimeTypeSpoofingTests = [
      {
        name: 'fake_image.jpg',
        content: '#!/bin/bash\necho "Not an image"',
        mimetype: 'image/jpeg',
        description: 'スクリプトをJPEGと偽装'
      },
      {
        name: 'malware.png',
        content: 'MZ\x90\x00\x03\x00\x00\x00',
        mimetype: 'image/png',
        description: '実行ファイルをPNGと偽装'
      },
      {
        name: 'virus.gif',
        content: '<script>alert("XSS")</script>',
        mimetype: 'image/gif',
        description: 'HTMLをGIFと偽装'
      }
    ];

    mimeTypeSpoofingTests.forEach(test => {
      it(`should detect MIME type spoofing: ${test.description}`, async () => {
        const response = await request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .field('Content-Type', test.mimetype)
          .attach('image', Buffer.from(test.content), test.name);

        // ファイルの実際の内容とMIMEタイプの不一致が検出される
        expect([
          HttpStatus.BAD_REQUEST,
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          HttpStatus.UNPROCESSABLE_ENTITY
        ]).toContain(response.status);
      });
    });
  });

  describe('3. 巨大ファイルによるDoS攻撃防御', () => {
    it('should reject files exceeding size limit', async () => {
      // 10MB の巨大ファイル生成（制限値を超える想定）
      const largeFileSize = 10 * 1024 * 1024; // 10MB
      const largeFileBuffer = Buffer.alloc(largeFileSize, 'A');

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssueId}/images`)
        .set('Authorization', `Basic ${authHeader}`)
        .timeout(30000) // 30秒タイムアウト
        .attach('image', largeFileBuffer, 'large_image.jpg');

      // ファイルサイズ制限により拒否されることを確認
      expect([
        HttpStatus.BAD_REQUEST,
        HttpStatus.PAYLOAD_TOO_LARGE,
        HttpStatus.REQUEST_TIMEOUT
      ]).toContain(response.status);
    });

    it('should handle multiple simultaneous large file uploads', async () => {
      // 同時に複数の大きなファイルをアップロード
      const mediumFileSize = 2 * 1024 * 1024; // 2MB
      const fileBuffer = Buffer.alloc(mediumFileSize, 'B');

      const uploadPromises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .timeout(15000)
          .attach('image', fileBuffer, `concurrent_${i}.jpg`)
      );

      const responses = await Promise.allSettled(uploadPromises);

      // 一部またはすべてのアップロードが制限により失敗することを確認
      const failedUploads = responses.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && result.value.status >= 400)
      );

      expect(failedUploads.length).toBeGreaterThan(0);
    });
  });

  describe('4. パストラバーサル攻撃防御', () => {
    const pathTraversalFilenames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      './../../config/database.yml',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..\\..\\..\\boot.ini',
      '/var/www/html/config.php',
      'C:\\Windows\\System32\\config\\SAM',
      '~/../../../../etc/passwd',
      '$HOME/../../../etc/passwd'
    ];

    pathTraversalFilenames.forEach((filename, index) => {
      it(`should prevent path traversal attack ${index + 1}: ${filename}`, async () => {
        // 小さな有効な画像データ（PNG形式）
        const validImageData = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
          0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
          0x49, 0x48, 0x44, 0x52, // IHDR
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // rest of IHDR
          0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
          0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x01, 0x00, 0xFE,
          0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
          0x00, 0x00, 0x00, 0x00, // IEND
          0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);

        const response = await request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .attach('image', validImageData, filename);

        // パストラバーサル攻撃が防御される
        expect([
          HttpStatus.BAD_REQUEST,
          HttpStatus.FORBIDDEN,
          HttpStatus.UNPROCESSABLE_ENTITY
        ]).toContain(response.status);

        if (response.status >= 400) {
          expect(response.body.message).toMatch(/invalid|not allowed|filename/i);
        }
      });
    });
  });

  describe('5. ファイル名攻撃防御', () => {
    const maliciousFilenames = [
      'image.jpg; rm -rf /', // コマンドインジェクション
      'image.jpg`whoami`', // バッククォート
      'image.jpg$(whoami)', // コマンド置換
      'image.jpg & del *.*', // Windows コマンド
      'image.jpg\x00.exe', // ヌルバイト攻撃
      '<script>alert("xss")</script>.jpg', // XSS
      'image.jpg\r\nContent-Type: text/html', // HTTPヘッダーインジェクション
      'CON.jpg', 'PRN.jpg', 'AUX.jpg', // Windows予約名
      'image.jpg.exe', // 二重拡張子
      '../../image.jpg',
      'image%.jpg', // 特殊文字
      'very_long_filename_' + 'a'.repeat(300) + '.jpg', // 長すぎるファイル名
    ];

    maliciousFilenames.forEach((filename, index) => {
      it(`should sanitize malicious filename ${index + 1}: ${filename}`, async () => {
        // 有効な小さなJPEG画像
        const validJpegData = Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
          0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
          0xFF, 0xDB, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02,
          0xFF, 0xD9 // EOI marker
        ]);

        const response = await request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .attach('image', validJpegData, filename);

        if (response.status === HttpStatus.CREATED) {
          // アップロードが成功した場合、ファイル名が適切にサニタイズされていることを確認
          expect(response.body).toHaveProperty('file_name');
          const sanitizedName = response.body.file_name;
          
          // サニタイズされたファイル名に危険な文字が含まれていないことを確認
          expect(sanitizedName).not.toMatch(/[<>"|;`$()&]/);
          expect(sanitizedName).not.toMatch(/\.\./);
          expect(sanitizedName).not.toMatch(/[\r\n]/);
          expect(sanitizedName.length).toBeLessThanOrEqual(255);
        } else {
          // アップロードが拒否された場合、適切なエラーメッセージが返されることを確認
          expect([HttpStatus.BAD_REQUEST, HttpStatus.UNPROCESSABLE_ENTITY]).toContain(response.status);
        }
      });
    });
  });

  describe('6. 画像ファイル内のメタデータ攻撃防御', () => {
    it('should strip dangerous EXIF metadata', async () => {
      // 悪意のあるEXIFデータを含むJPEG画像（模擬）
      const jpegWithMaliciousExif = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x16, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
        0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3E, 0x61, 0x6C, 0x65, 0x72,
        0x74, 0x28, 0x22, 0x58, 0x53, 0x53, 0x22, 0x29, 0x3C, 0x2F, 0x73, 0x63,
        0x72, 0x69, 0x70, 0x74, 0x3E, // <script>alert("XSS")</script>
        0xFF, 0xDB, 0x00, 0x43, 0x00,
        0xFF, 0xD9 // EOI marker
      ]);

      const response = await request(app.getHttpServer())
        .post(`/issues/${testIssueId}/images`)
        .set('Authorization', `Basic ${authHeader}`)
        .attach('image', jpegWithMaliciousExif, 'exif_malware.jpg');

      if (response.status === HttpStatus.CREATED) {
        // アップロードが成功した場合、処理された画像からメタデータが除去されていることを期待
        const imageId = response.body.id;
        
        // 画像取得
        const imageResponse = await request(app.getHttpServer())
          .get(`/images/${imageId}`)
          .set('Authorization', `Basic ${authHeader}`);

        expect(imageResponse.status).toBe(HttpStatus.OK);
        
        // レスポンスヘッダーでスクリプト実行が試行されていないことを確認
        expect(imageResponse.headers['content-type']).toMatch(/^image\//);
      }
    });

    it('should validate image file headers', async () => {
      // 不正なヘッダーを持つファイル
      const invalidHeaders = [
        { name: 'fake.jpg', data: 'Not a real JPEG file', description: '無効なJPEGヘッダー' },
        { name: 'fake.png', data: 'PNG but not really', description: '無効なPNGヘッダー' },
        { name: 'fake.gif', data: 'GIF87a_fake', description: '無効なGIFヘッダー' },
      ];

      for (const test of invalidHeaders) {
        const response = await request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .attach('image', Buffer.from(test.data), test.name);

        // 不正なファイルヘッダーが検出され拒否される
        expect([
          HttpStatus.BAD_REQUEST,
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          HttpStatus.UNPROCESSABLE_ENTITY
        ]).toContain(response.status);
      }
    });
  });

  describe('7. アップロードレート制限', () => {
    it('should enforce upload rate limiting', async () => {
      // 短時間での大量アップロード試行
      const smallImageData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
        0xFF, 0xD9
      ]);

      const rapidUploadPromises = Array.from({ length: 20 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .attach('image', smallImageData, `rapid_${i}.jpg`)
      );

      const responses = await Promise.allSettled(rapidUploadPromises);
      const statusCodes = responses
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as any).value.status);

      // レート制限により一部のリクエストが拒否されることを期待
      const rateLimitedRequests = statusCodes.filter(status => 
        status === HttpStatus.TOO_MANY_REQUESTS || status >= 400
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });
  });

  describe('8. ストレージクォータ制限', () => {
    it('should enforce storage quota per project/issue', async () => {
      // プロジェクト/Issue単位でのストレージ制限テスト
      const mediumImageData = Buffer.alloc(500 * 1024, 0xFF); // 500KB

      let uploadCount = 0;
      let lastSuccessfulUpload = true;

      // ストレージ制限に達するまでアップロードを続行
      for (let i = 0; i < 50 && lastSuccessfulUpload; i++) {
        const response = await request(app.getHttpServer())
          .post(`/issues/${testIssueId}/images`)
          .set('Authorization', `Basic ${authHeader}`)
          .timeout(10000)
          .attach('image', mediumImageData, `storage_test_${i}.jpg`);

        if (response.status === HttpStatus.CREATED) {
          uploadCount++;
        } else {
          lastSuccessfulUpload = false;
          
          // ストレージ制限エラーが適切に処理されることを確認
          expect([
            HttpStatus.BAD_REQUEST,
            HttpStatus.INSUFFICIENT_STORAGE,
            HttpStatus.FORBIDDEN
          ]).toContain(response.status);
        }
      }

      // 少なくとも1つはアップロード成功し、どこかで制限に達することを確認
      expect(uploadCount).toBeGreaterThan(0);
      expect(uploadCount).toBeLessThan(50); // 制限により全てはアップロードできない
    });
  });
});