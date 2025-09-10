import { ScheduleCalculatorUtil } from './schedule-calculator.util';
import { BusinessDayConfig } from '../interfaces/schedule-adjustment.interface';

/**
 * ScheduleCalculatorUtil の単体テスト
 * 
 * テスト対象:
 * - 営業日判定（isBusinessDay）
 * - 営業日追加計算（addBusinessDays）
 * - 営業日数計算（calculateBusinessDays）
 * - FS依存関係の最早開始日計算（calculateEarliestStartForFS）
 * - 工数から期間計算（calculateDurationFromEffort）
 * - 開始日から終了日計算（calculateEndDateFromStart）
 * - 日付フォーマット・パース機能
 * - 現在営業日取得（getCurrentBusinessDay）
 * 
 * テストカバレッジ:
 * - 正常系: 基本的な日付計算、営業日計算
 * - 異常系: 不正な日付、負の値
 * - 境界値: 週末、祝日、月またぎ、年またぎ
 * - 休日設定: weekend_offのON/OFF、holiday_datesの各種パターン
 */
describe('ScheduleCalculatorUtil', () => {
  // テスト用の営業日設定
  const standardConfig: BusinessDayConfig = {
    weekend_off: true,
    holiday_dates: ['2024-01-01', '2024-01-08'], // 月曜日と月曜日
  };

  const noWeekendConfig: BusinessDayConfig = {
    weekend_off: false,
    holiday_dates: ['2024-01-01'],
  };

  const holidayHeavyConfig: BusinessDayConfig = {
    weekend_off: true,
    holiday_dates: [
      '2024-01-01', '2024-01-02', '2024-01-03', // 連続祝日
      '2024-01-15', // 散発祝日
    ],
  };

  describe('isBusinessDay', () => {
    it('正常系: 平日は営業日と判定される', () => {
      // 2024-01-02は火曜日
      const tuesday = new Date('2024-01-02');
      expect(ScheduleCalculatorUtil.isBusinessDay(tuesday, standardConfig)).toBe(true);
    });

    it('正常系: 土曜日は非営業日と判定される（weekend_off: true）', () => {
      // 2024-01-06は土曜日
      const saturday = new Date('2024-01-06');
      expect(ScheduleCalculatorUtil.isBusinessDay(saturday, standardConfig)).toBe(false);
    });

    it('正常系: 日曜日は非営業日と判定される（weekend_off: true）', () => {
      // 2024-01-07は日曜日
      const sunday = new Date('2024-01-07');
      expect(ScheduleCalculatorUtil.isBusinessDay(sunday, standardConfig)).toBe(false);
    });

    it('正常系: 土曜日は営業日と判定される（weekend_off: false）', () => {
      // 2024-01-06は土曜日
      const saturday = new Date('2024-01-06');
      expect(ScheduleCalculatorUtil.isBusinessDay(saturday, noWeekendConfig)).toBe(true);
    });

    it('正常系: 日曜日は営業日と判定される（weekend_off: false）', () => {
      // 2024-01-07は日曜日
      const sunday = new Date('2024-01-07');
      expect(ScheduleCalculatorUtil.isBusinessDay(sunday, noWeekendConfig)).toBe(true);
    });

    it('正常系: 祝日は非営業日と判定される', () => {
      // 2024-01-01は祝日設定
      const holiday = new Date('2024-01-01');
      expect(ScheduleCalculatorUtil.isBusinessDay(holiday, standardConfig)).toBe(false);
    });

    it('境界値: 祝日かつ土曜日の場合は非営業日と判定される', () => {
      const config: BusinessDayConfig = {
        weekend_off: true,
        holiday_dates: ['2024-01-06'], // 土曜日を祝日に設定
      };
      const saturdayHoliday = new Date('2024-01-06');
      expect(ScheduleCalculatorUtil.isBusinessDay(saturdayHoliday, config)).toBe(false);
    });

    it('境界値: 月またぎの日付も正しく判定される', () => {
      // 2024-01-31は水曜日
      const endOfMonth = new Date('2024-01-31');
      expect(ScheduleCalculatorUtil.isBusinessDay(endOfMonth, standardConfig)).toBe(true);
    });
  });

  describe('addBusinessDays', () => {
    it('正常系: 営業日を正しく追加できる', () => {
      // 2024-01-02（火曜日）から3営業日後 = 2024-01-05（金曜日）
      // 実装：開始日の翌日から営業日を数える
      const startDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.addBusinessDays(startDate, 3, standardConfig);
      
      expect(result.getDate()).toBe(5);
      expect(result.getMonth()).toBe(0); // 1月
    });

    it('正常系: 週末をスキップして営業日を追加できる', () => {
      // 2024-01-05（金曜日）から3営業日後
      // 土日をスキップして 2024-01-11（木曜日）、祝日月曜日もスキップ
      const friday = new Date('2024-01-05');
      const result = ScheduleCalculatorUtil.addBusinessDays(friday, 3, standardConfig);
      
      expect(result.getDate()).toBe(11);
      expect(result.getDay()).toBe(4); // 木曜日
    });

    it('正常系: 祝日をスキップして営業日を追加できる', () => {
      // 2024-01-04（木曜日）から2営業日後
      // 2024-01-08（月曜日）は祝日なので、2024-01-09（火曜日）になる
      const thursday = new Date('2024-01-04');
      const result = ScheduleCalculatorUtil.addBusinessDays(thursday, 2, standardConfig);
      
      expect(result.getDate()).toBe(9);
      expect(result.getDay()).toBe(2); // 火曜日
    });

    it('境界値: 0営業日追加の場合は開始日をそのまま返す', () => {
      const startDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.addBusinessDays(startDate, 0, standardConfig);
      
      expect(result.getTime()).toBe(startDate.getTime());
    });

    it('境界値: 負の営業日数の場合は開始日をそのまま返す', () => {
      const startDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.addBusinessDays(startDate, -5, standardConfig);
      
      expect(result.getTime()).toBe(startDate.getTime());
    });

    it('境界値: 月またぎで営業日を追加できる', () => {
      // 2024-01-30（火曜日）から5営業日後 = 2024-02-06（火曜日）
      const endOfMonth = new Date('2024-01-30');
      const result = ScheduleCalculatorUtil.addBusinessDays(endOfMonth, 5, standardConfig);
      
      expect(result.getDate()).toBe(6);
      expect(result.getMonth()).toBe(1); // 2月
    });

    it('境界値: 連続祝日を正しくスキップできる', () => {
      // 2023-12-28（木曜日）から3営業日後
      // 年末年始の連続祝日をスキップして計算 -> 2024-01-05（金曜日）
      const beforeHolidays = new Date('2023-12-28');
      const result = ScheduleCalculatorUtil.addBusinessDays(beforeHolidays, 3, {
        weekend_off: true,
        holiday_dates: ['2023-12-29', '2023-12-30', '2024-01-01', '2024-01-02'],
      });
      
      expect(result.getDate()).toBe(5); // 2024-01-05
      expect(result.getMonth()).toBe(0); // 1月
    });
  });

  describe('calculateBusinessDays', () => {
    it('正常系: 営業日数を正しく計算できる', () => {
      // 2024-01-02（火曜日）から 2024-01-04（木曜日）まで = 3営業日
      const startDate = new Date('2024-01-02');
      const endDate = new Date('2024-01-04');
      const result = ScheduleCalculatorUtil.calculateBusinessDays(startDate, endDate, standardConfig);
      
      expect(result).toBe(3);
    });

    it('正常系: 週末を除外して営業日数を計算できる', () => {
      // 2024-01-05（金曜日）から 2024-01-09（火曜日）まで
      // 金、月、火 = 3営業日（土日は除外、月曜日は祝日なので除外）
      const friday = new Date('2024-01-05');
      const tuesday = new Date('2024-01-09');
      const result = ScheduleCalculatorUtil.calculateBusinessDays(friday, tuesday, standardConfig);
      
      expect(result).toBe(2); // 金曜日、火曜日のみ（祝日月曜日は除外）
    });

    it('正常系: 祝日を除外して営業日数を計算できる', () => {
      // 2024-01-01（祝日）から 2024-01-03（水曜日）まで
      // 火、水 = 2営業日（祝日は除外）
      const holiday = new Date('2024-01-01');
      const wednesday = new Date('2024-01-03');
      const result = ScheduleCalculatorUtil.calculateBusinessDays(holiday, wednesday, standardConfig);
      
      expect(result).toBe(2);
    });

    it('境界値: 開始日と終了日が同じ場合', () => {
      const sameDate = new Date('2024-01-02'); // 火曜日（営業日）
      const result = ScheduleCalculatorUtil.calculateBusinessDays(sameDate, sameDate, standardConfig);
      
      expect(result).toBe(1);
    });

    it('境界値: 開始日が終了日より後の場合は0を返す', () => {
      const startDate = new Date('2024-01-05');
      const endDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.calculateBusinessDays(startDate, endDate, standardConfig);
      
      expect(result).toBe(0);
    });

    it('境界値: 期間が全て非営業日の場合は0を返す', () => {
      // 2024-01-06（土曜日）から 2024-01-07（日曜日）まで = 0営業日
      const saturday = new Date('2024-01-06');
      const sunday = new Date('2024-01-07');
      const result = ScheduleCalculatorUtil.calculateBusinessDays(saturday, sunday, standardConfig);
      
      expect(result).toBe(0);
    });
  });

  describe('calculateEarliestStartForFS', () => {
    it('正常系: FS依存関係の最早開始日を正しく計算できる', () => {
      // 先行タスク終了日: 2024-01-04（木曜日）
      // 翌営業日: 2024-01-05（金曜日）
      const predecessorEnd = new Date('2024-01-04');
      const result = ScheduleCalculatorUtil.calculateEarliestStartForFS(predecessorEnd, standardConfig);
      
      expect(result.getDate()).toBe(5);
      expect(result.getDay()).toBe(5); // 金曜日
    });

    it('正常系: 先行タスクが金曜日終了の場合、月曜日開始になる', () => {
      // 先行タスク終了日: 2024-01-05（金曜日）
      // 翌営業日: 2024-01-08（月曜日）だが祝日なので 2024-01-09（火曜日）
      const fridayEnd = new Date('2024-01-05');
      const result = ScheduleCalculatorUtil.calculateEarliestStartForFS(fridayEnd, standardConfig);
      
      expect(result.getDate()).toBe(9); // 祝日月曜日をスキップして火曜日
      expect(result.getDay()).toBe(2); // 火曜日
    });

    it('境界値: 先行タスクが祝日終了の場合、次の営業日を取得できる', () => {
      // 先行タスク終了日: 2024-01-01（祝日・月曜日）
      // 翌営業日: 2024-01-02（火曜日）
      const holidayEnd = new Date('2024-01-01');
      const result = ScheduleCalculatorUtil.calculateEarliestStartForFS(holidayEnd, standardConfig);
      
      expect(result.getDate()).toBe(2);
      expect(result.getDay()).toBe(2); // 火曜日
    });

    it('境界値: 連続祝日をスキップして最早開始日を取得できる', () => {
      // 先行タスク終了日: 2024-01-01（祝日）
      // 2024-01-02, 2024-01-03も祝日の場合、2024-01-04（木曜日）が開始日
      const holidayEnd = new Date('2024-01-01');
      const result = ScheduleCalculatorUtil.calculateEarliestStartForFS(holidayEnd, holidayHeavyConfig);
      
      expect(result.getDate()).toBe(4);
      expect(result.getDay()).toBe(4); // 木曜日
    });
  });

  describe('calculateDurationFromEffort', () => {
    it('正常系: 工数から期間を正しく計算できる', () => {
      // 32時間 ÷ 8時間/日 = 4日
      const result = ScheduleCalculatorUtil.calculateDurationFromEffort(32, 8);
      expect(result).toBe(4);
    });

    it('正常系: 工数が日割りで割り切れない場合は切り上げになる', () => {
      // 30時間 ÷ 8時間/日 = 3.75日 → 4日（切り上げ）
      const result = ScheduleCalculatorUtil.calculateDurationFromEffort(30, 8);
      expect(result).toBe(4);
    });

    it('境界値: 0時間の場合は0日を返す', () => {
      const result = ScheduleCalculatorUtil.calculateDurationFromEffort(0, 8);
      expect(result).toBe(0);
    });

    it('境界値: 負の工数の場合は0日を返す', () => {
      const result = ScheduleCalculatorUtil.calculateDurationFromEffort(-10, 8);
      expect(result).toBe(0);
    });

    it('境界値: デフォルトの作業時間（8時間/日）が適用される', () => {
      // 第2引数を省略した場合、デフォルトで8時間/日が使用される
      const result = ScheduleCalculatorUtil.calculateDurationFromEffort(16);
      expect(result).toBe(2);
    });

    it('境界値: 非標準の作業時間（4時間/日）での計算', () => {
      // 16時間 ÷ 4時間/日 = 4日
      const result = ScheduleCalculatorUtil.calculateDurationFromEffort(16, 4);
      expect(result).toBe(4);
    });
  });

  describe('calculateEndDateFromStart', () => {
    it('正常系: 開始日と工数から終了日を計算できる', () => {
      // 2024-01-02（火曜日）開始、32時間（4日）
      // 終了日: 2024-01-05（金曜日）
      const startDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.calculateEndDateFromStart(startDate, 32, standardConfig, 8);
      
      expect(result.getDate()).toBe(5);
      expect(result.getDay()).toBe(5); // 金曜日
    });

    it('正常系: 週末をスキップして終了日を計算できる', () => {
      // 2024-01-04（木曜日）開始、24時間（3日）
      // 木、金、月曜日（祝日スキップで火曜日）= 2024-01-09（火曜日）終了
      const thursday = new Date('2024-01-04');
      const result = ScheduleCalculatorUtil.calculateEndDateFromStart(thursday, 24, standardConfig, 8);
      
      expect(result.getDate()).toBe(9);
      expect(result.getDay()).toBe(2); // 火曜日
    });

    it('境界値: 0時間の場合は開始日と同じ日付を返す', () => {
      const startDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.calculateEndDateFromStart(startDate, 0, standardConfig);
      
      expect(result.getTime()).toBe(startDate.getTime());
    });

    it('境界値: 1日分の工数の場合は開始日と同じ日付を返す', () => {
      // 8時間（1日）の場合、開始日=終了日
      const startDate = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.calculateEndDateFromStart(startDate, 8, standardConfig, 8);
      
      expect(result.getTime()).toBe(startDate.getTime());
    });
  });

  describe('日付フォーマット・パース機能', () => {
    it('formatDateToString: 日付を YYYY-MM-DD 形式に変換できる', () => {
      const date = new Date('2024-01-02');
      const result = ScheduleCalculatorUtil.formatDateToString(date);
      
      expect(result).toBe('2024-01-02');
    });

    it('formatDateToString: 月・日が1桁の場合は0埋めされる', () => {
      const date = new Date('2024-03-05');
      const result = ScheduleCalculatorUtil.formatDateToString(date);
      
      expect(result).toBe('2024-03-05');
    });

    it('parseStringToDate: YYYY-MM-DD 形式の文字列を日付に変換できる', () => {
      const result = ScheduleCalculatorUtil.parseStringToDate('2024-01-02');
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // 1月（0ベース）
      expect(result.getDate()).toBe(2);
    });

    it('parseStringToDate: 月末日付も正しくパースできる', () => {
      const result = ScheduleCalculatorUtil.parseStringToDate('2024-01-31');
      
      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(0);
    });
  });

  describe('isValidDate', () => {
    it('正常系: 有効な日付はtrueを返す', () => {
      const validDate = new Date('2024-01-02');
      expect(ScheduleCalculatorUtil.isValidDate(validDate)).toBe(true);
    });

    it('境界値: 無効な日付はfalseを返す', () => {
      const invalidDate = new Date('invalid-date');
      expect(ScheduleCalculatorUtil.isValidDate(invalidDate)).toBe(false);
    });

    it('境界値: nullはfalseを返す', () => {
      expect(ScheduleCalculatorUtil.isValidDate(null)).toBe(false);
    });

    it('境界値: undefinedはfalseを返す', () => {
      expect(ScheduleCalculatorUtil.isValidDate(undefined)).toBe(false);
    });

    it('境界値: 日付以外のオブジェクトはfalseを返す', () => {
      expect(ScheduleCalculatorUtil.isValidDate({} as Date)).toBe(false);
      expect(ScheduleCalculatorUtil.isValidDate('2024-01-02' as any)).toBe(false);
    });
  });

  describe('getCurrentBusinessDay', () => {
    it('正常系: 今日が営業日の場合は今日を返す（モックなし）', () => {
      // 2024-01-02（火曜日）を固定日付として使用
      const fixedDate = new Date('2024-01-02T00:00:00.000Z');
      
      // スパイを使って日付を固定
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation((date?: any) => {
        if (date === undefined) {
          return fixedDate;
        }
        return new Date(date);
      });

      const result = ScheduleCalculatorUtil.getCurrentBusinessDay(standardConfig);
      
      expect(result.getDate()).toBe(2);
      expect(result.getDay()).toBe(2); // 火曜日

      // スパイを復元
      dateSpy.mockRestore();
    });
  });

  describe('複雑な営業日計算シナリオ', () => {
    it('境界値: 年末年始をまたいだ営業日計算', () => {
      const yearEndConfig: BusinessDayConfig = {
        weekend_off: true,
        holiday_dates: [
          '2023-12-29', '2023-12-30', '2023-12-31',
          '2024-01-01', '2024-01-02', '2024-01-03',
        ],
      };

      // 2023-12-28（木曜日）から5営業日後 -> 2024-01-10（水曜日）
      const startDate = new Date('2023-12-28');
      const result = ScheduleCalculatorUtil.addBusinessDays(startDate, 5, yearEndConfig);
      
      // 年明けの営業日を正しく計算
      expect(result.getMonth()).toBe(0); // 1月
      expect(result.getDate()).toBe(10); // 2024-01-10（水曜日）
    });

    it('境界値: 2月末（うるう年）での営業日計算', () => {
      const leapYearConfig: BusinessDayConfig = {
        weekend_off: true,
        holiday_dates: [],
      };

      // 2024-02-28（水曜日）から3営業日後
      const startDate = new Date('2024-02-28');
      const result = ScheduleCalculatorUtil.addBusinessDays(startDate, 3, leapYearConfig);
      
      // うるう年の2月29日を正しく扱える
      expect(result.getMonth()).toBe(2); // 3月
      expect(result.getDate()).toBe(4); // 2024-03-04（月曜日）
    });

    it('境界値: 1年間の営業日数計算（概算）', () => {
      const fullYearConfig: BusinessDayConfig = {
        weekend_off: true,
        holiday_dates: [], // 祝日なし
      };

      // 2024年1月1日から12月31日までの営業日数
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = ScheduleCalculatorUtil.calculateBusinessDays(startDate, endDate, fullYearConfig);
      
      // 1年間の営業日数は概ね260日程度（366日 - 週末104-105日）
      expect(result).toBeGreaterThan(250);
      expect(result).toBeLessThan(270);
    });
  });

  describe('パフォーマンステスト', () => {
    it('境界値: 大きな営業日数を効率的に計算できる', () => {
      const startDate = new Date('2024-01-01');
      const largeDays = 1000; // 1000営業日

      const startTime = Date.now();
      const result = ScheduleCalculatorUtil.addBusinessDays(startDate, largeDays, standardConfig);
      const endTime = Date.now();

      // 処理時間が合理的な範囲内（1秒以内）であることを確認
      expect(endTime - startTime).toBeLessThan(1000);
      
      // 結果が妥当であることを確認
      expect(result).toBeInstanceOf(Date);
      expect(result > startDate).toBe(true);
    });

    it('境界値: 長期間の営業日数計算が効率的に実行される', () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2024-12-31'); // 5年間

      const startTime = Date.now();
      const result = ScheduleCalculatorUtil.calculateBusinessDays(startDate, endDate, standardConfig);
      const endTime = Date.now();

      // 処理時間が合理的な範囲内（1秒以内）であることを確認
      expect(endTime - startTime).toBeLessThan(1000);
      
      // 結果が妥当であることを確認（5年間の営業日数は約1300日）
      expect(result).toBeGreaterThan(1200);
      expect(result).toBeLessThan(1400);
    });
  });
});