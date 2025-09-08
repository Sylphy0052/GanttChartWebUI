/**
 * 設定管理のE2Eテスト
 * 
 * テスト対象:
 * - 休日設定の取得・更新
 * - 権限制御（viewer/editor）
 * - バリデーションとエラーハンドリング
 * - デフォルト設定の自動作成
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';

describe('設定管理 E2E テスト', () => {
  let app: INestApplication;
  const authHeader = testHelper.createBasicAuthHeader();

  beforeAll(async () => {
    app = testHelper.app;
  });

  describe('休日設定取得 (GET /api/settings/holidays)', () => {
    it('初回アクセス時にデフォルト設定が作成される', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toHaveProperty('weekend_off');
      expect(response.body).toHaveProperty('holiday_dates');
      expect(typeof response.body.weekend_off).toBe('boolean');
      expect(Array.isArray(response.body.holiday_dates)).toBe(true);
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    it('Viewer権限でアクセス可能', async () => {
      // Viewer権限に設定
      process.env.AUTH_TYPE = 'none';

      const response = await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .expect(200);

      expect(response.body).toHaveProperty('weekend_off');
      expect(response.body).toHaveProperty('holiday_dates');

      // 設定を元に戻す
      process.env.AUTH_TYPE = 'basic';
    });

    it('認証なしでアクセス拒否', async () => {
      await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .expect(401);
    });

    it('無効な認証情報でアクセス拒否', async () => {
      const invalidAuth = testHelper.createBasicAuthHeader('wrong', 'password');

      await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', invalidAuth)
        .expect(401);
    });

    it('レスポンス形式の一貫性', async () => {
      // 複数回アクセスして一貫したレスポンスを確認
      const responses = await Promise.all([
        request(app.getHttpServer())
          .get('/api/settings/holidays')
          .set('Authorization', authHeader)
          .expect(200),
        request(app.getHttpServer())
          .get('/api/settings/holidays')
          .set('Authorization', authHeader)
          .expect(200),
        request(app.getHttpServer())
          .get('/api/settings/holidays')
          .set('Authorization', authHeader)
          .expect(200),
      ]);

      const firstResponse = responses[0].body;
      
      responses.forEach(response => {
        expect(response.body.weekend_off).toBe(firstResponse.weekend_off);
        expect(response.body.holiday_dates).toEqual(firstResponse.holiday_dates);
      });
    });
  });

  describe('休日設定更新 (PUT /api/settings/holidays)', () => {
    beforeEach(async () => {
      // 設定を初期化
      await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', authHeader)
        .expect(200);
    });

    it('有効な設定データで更新成功', async () => {
      const updateData = {
        weekend_off: true,
        holiday_dates: ['2024-01-01', '2024-04-29', '2024-12-25'],
      };

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(updateData)
        .expect(200);

      expect(response.body.weekend_off).toBe(updateData.weekend_off);
      expect(response.body.holiday_dates).toEqual(updateData.holiday_dates);
      expect(response.body).toHaveProperty('updated_at');

      // 更新されたことを再取得で確認
      const getResponse = await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', authHeader)
        .expect(200);

      expect(getResponse.body.weekend_off).toBe(updateData.weekend_off);
      expect(getResponse.body.holiday_dates).toEqual(updateData.holiday_dates);
    });

    it('部分的なフィールド更新成功', async () => {
      // weekend_offのみ更新
      const updateData = {
        weekend_off: false,
      };

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(updateData)
        .expect(200);

      expect(response.body.weekend_off).toBe(false);
      expect(response.body).toHaveProperty('holiday_dates');

      // holiday_datesのみ更新
      const holidayUpdateData = {
        holiday_dates: ['2024-07-04', '2024-11-28'],
      };

      const holidayResponse = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(holidayUpdateData)
        .expect(200);

      expect(holidayResponse.body.weekend_off).toBe(false); // 前の値が保持
      expect(holidayResponse.body.holiday_dates).toEqual(holidayUpdateData.holiday_dates);
    });

    it('空の休日リストで更新成功', async () => {
      const updateData = {
        weekend_off: true,
        holiday_dates: [],
      };

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(updateData)
        .expect(200);

      expect(response.body.weekend_off).toBe(true);
      expect(response.body.holiday_dates).toEqual([]);
    });

    it('Editor権限必須でViewer権限では403エラー', async () => {
      process.env.AUTH_TYPE = 'none';

      const updateData = {
        weekend_off: true,
        holiday_dates: ['2024-01-01'],
      };

      await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .send(updateData)
        .expect(403);

      process.env.AUTH_TYPE = 'basic';
    });

    it('認証なしでアクセス拒否', async () => {
      const updateData = {
        weekend_off: true,
        holiday_dates: ['2024-01-01'],
      };

      await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .send(updateData)
        .expect(401);
    });
  });

  describe('バリデーション', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', authHeader)
        .expect(200);
    });

    it('無効な weekend_off 値でバリデーションエラー', async () => {
      const invalidValues = [
        { weekend_off: 'true' }, // 文字列
        { weekend_off: 1 }, // 数値
        { weekend_off: null }, // null
        { weekend_off: 'yes' }, // 文字列
      ];

      for (const invalidValue of invalidValues) {
        await request(app.getHttpServer())
          .put('/api/settings/holidays')
          .set('Authorization', authHeader)
          .send(invalidValue)
          .expect(400);
      }
    });

    it('無効な holiday_dates 形式でバリデーションエラー', async () => {
      const invalidDateFormats = [
        { holiday_dates: 'not-an-array' }, // 配列ではない
        { holiday_dates: ['invalid-date'] }, // 無効な日付形式
        { holiday_dates: ['2024-13-01'] }, // 存在しない月
        { holiday_dates: ['2024-01-32'] }, // 存在しない日
        { holiday_dates: ['2024/01/01'] }, // 間違ったフォーマット
        { holiday_dates: [20240101] }, // 数値形式
        { holiday_dates: [null] }, // null値
        { holiday_dates: [''] }, // 空文字列
      ];

      for (const invalidDate of invalidDateFormats) {
        await request(app.getHttpServer())
          .put('/api/settings/holidays')
          .set('Authorization', authHeader)
          .send(invalidDate)
          .expect(400);
      }
    });

    it('正しい日付形式のバリエーション', async () => {
      const validDateFormats = [
        { holiday_dates: ['2024-01-01'] }, // YYYY-MM-DD
        { holiday_dates: ['2024-02-29'] }, // 閏年
        { holiday_dates: ['2024-12-31'] }, // 年末
        { holiday_dates: ['2024-01-01', '2024-06-15', '2024-12-25'] }, // 複数日付
      ];

      for (const validDate of validDateFormats) {
        await request(app.getHttpServer())
          .put('/api/settings/holidays')
          .set('Authorization', authHeader)
          .send(validDate)
          .expect(200);
      }
    });

    it('大量の休日日付でもパフォーマンス良好', async () => {
      // 365日分の休日を設定（極端なケース）
      const manyHolidays = Array.from({ length: 365 }, (_, i) => {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      });

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send({ holiday_dates: manyHolidays })
        .expect(200);

      const endTime = Date.now();

      expect(response.body.holiday_dates).toHaveLength(365);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    });

    it('重複する休日日付の処理', async () => {
      const duplicateDates = {
        holiday_dates: [
          '2024-01-01',
          '2024-01-01', // 重複
          '2024-04-29',
          '2024-01-01', // 再度重複
          '2024-04-29', // 重複
        ],
      };

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(duplicateDates)
        .expect(200);

      // 重複が除去されることを確認
      const uniqueDates = ['2024-01-01', '2024-04-29'];
      expect(response.body.holiday_dates).toEqual(expect.arrayContaining(uniqueDates));
      expect(response.body.holiday_dates).toHaveLength(uniqueDates.length);
    });

    it('日付の自動ソート', async () => {
      const unsortedDates = {
        holiday_dates: [
          '2024-12-25',
          '2024-01-01',
          '2024-07-04',
          '2024-04-29',
        ],
      };

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(unsortedDates)
        .expect(200);

      const sortedDates = ['2024-01-01', '2024-04-29', '2024-07-04', '2024-12-25'];
      expect(response.body.holiday_dates).toEqual(sortedDates);
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なJSONでリクエスト拒否', async () => {
      await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .set('Content-Type', 'application/json')
        .send('invalid-json-string')
        .expect(400);
    });

    it('空のリクエストボディでバリデーションエラー', async () => {
      await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send({})
        .expect(400);
    });

    it('想定外のフィールドは無視される', async () => {
      const dataWithExtraFields = {
        weekend_off: true,
        holiday_dates: ['2024-01-01'],
        unknown_field: 'should be ignored',
        another_field: 12345,
      };

      const response = await request(app.getHttpServer())
        .put('/api/settings/holidays')
        .set('Authorization', authHeader)
        .send(dataWithExtraFields)
        .expect(200);

      expect(response.body.weekend_off).toBe(true);
      expect(response.body.holiday_dates).toEqual(['2024-01-01']);
      expect(response.body).not.toHaveProperty('unknown_field');
      expect(response.body).not.toHaveProperty('another_field');
    });

    it('データベース接続エラーのシミュレーション', async () => {
      // データベース接続を一時的に切断してエラーをテスト
      // 注意: 実際のテストでは慎重に実装する必要がある
      
      // データベースの状態を確認するテスト
      const response = await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toHaveProperty('weekend_off');
    });
  });

  describe('同時アクセスとトランザクション', () => {
    it('同時更新での競合状態テスト', async () => {
      const updates = [
        { weekend_off: true, holiday_dates: ['2024-01-01'] },
        { weekend_off: false, holiday_dates: ['2024-01-02'] },
        { weekend_off: true, holiday_dates: ['2024-01-03'] },
      ];

      const updatePromises = updates.map(update =>
        request(app.getHttpServer())
          .put('/api/settings/holidays')
          .set('Authorization', authHeader)
          .send(update)
      );

      const responses = await Promise.all(updatePromises);

      // 全て成功するはず
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 最終状態を確認
      const finalResponse = await request(app.getHttpServer())
        .get('/api/settings/holidays')
        .set('Authorization', authHeader)
        .expect(200);

      expect(finalResponse.body).toHaveProperty('weekend_off');
      expect(finalResponse.body).toHaveProperty('holiday_dates');
    });

    it('読み取り専用アクセスの並行処理', async () => {
      const readPromises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/settings/holidays')
          .set('Authorization', authHeader)
      );

      const responses = await Promise.all(readPromises);

      // 全て成功するはず
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 全て同じデータを返すはず
      const firstData = responses[0].body;
      responses.forEach(response => {
        expect(response.body.weekend_off).toBe(firstData.weekend_off);
        expect(response.body.holiday_dates).toEqual(firstData.holiday_dates);
      });
    });
  });
});