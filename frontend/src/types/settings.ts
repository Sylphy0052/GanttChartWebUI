/**
 * Types for Global Settings functionality
 * Corresponds to backend Settings DTOs
 */

export interface HolidaySettings {
  /** Whether weekends (Saturday & Sunday) should be treated as holidays */
  weekend_off: boolean;
  /** Array of fixed holiday dates in YYYY-MM-DD format */
  holiday_dates: string[];
}

export interface UpdateHolidaySettingsDto {
  /** Optional weekend setting update */
  weekend_off?: boolean;
  /** Optional fixed holidays update */
  holiday_dates?: string[];
}

export interface HolidaySettingsResponse extends HolidaySettings {}