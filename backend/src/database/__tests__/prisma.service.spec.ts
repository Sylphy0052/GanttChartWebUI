import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';

/**
 * PrismaService ユニットテスト
 * データベース接続なしでサービスの基本動作をテスト
 */
describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (service) {
      await service.$disconnect();
    }
  });

  describe('インスタンス化', () => {
    it('PrismaServiceが正常にインスタンス化される', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PrismaService);
    });

    it('PrismaClientのメソッドが利用可能', () => {
      expect(typeof service.$connect).toBe('function');
      expect(typeof service.$disconnect).toBe('function');
      expect(typeof service.$transaction).toBe('function');
      expect(typeof service.$queryRaw).toBe('function');
    });

    it('カスタムメソッドが利用可能', () => {
      expect(typeof service.testConnection).toBe('function');
      expect(typeof service.executeTransaction).toBe('function');
    });
  });

  describe('モデルアクセス', () => {
    it('全てのモデルが利用可能', () => {
      const expectedModels = [
        'project',
        'globalSettings', 
        'issue',
        'dependency',
        'comment',
        'changeLog',
        'imagePath'
      ];

      expectedModels.forEach(model => {
        expect(service[model]).toBeDefined();
        expect(typeof service[model]).toBe('object');
      });
    });
  });

  describe('executeTransaction', () => {
    it('トランザクション実行メソッドが存在する', () => {
      expect(typeof service.executeTransaction).toBe('function');
    });

    it('トランザクション実行の型定義が正しい', async () => {
      // モック関数でトランザクションをテスト
      const mockTransactionFn = jest.fn().mockResolvedValue('test result');
      service.$transaction = mockTransactionFn;

      const testFn = async (prisma: any) => 'test result';
      const result = await service.executeTransaction(testFn);

      expect(mockTransactionFn).toHaveBeenCalledWith(testFn);
      expect(result).toBe('test result');
    });
  });
});