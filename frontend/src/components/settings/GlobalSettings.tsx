'use client';

import React, { useState, useEffect } from 'react';
import { settingsApi, ApiError } from '@/lib/api';
import { HolidaySettings, UpdateHolidaySettingsDto } from '@/types/settings';
import HolidayDatePicker from './HolidayDatePicker';

interface GlobalSettingsProps {
  /** Optional callback when settings are successfully updated */
  onSettingsUpdated?: (settings: HolidaySettings) => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onSettingsUpdated }) => {
  const [settings, setSettings] = useState<HolidaySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Local state for form data
  const [formData, setFormData] = useState<HolidaySettings>({
    weekend_off: false,
    holiday_dates: [],
  });

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await settingsApi.getHolidaySettings();
      setSettings(data);
      setFormData(data);
      setHasUnsavedChanges(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`設定の読み込みに失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleWeekendOffChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, weekend_off: checked }));
    setHasUnsavedChanges(true);
  };

  const handleHolidayDatesChange = (holidays: string[]) => {
    setFormData(prev => ({ ...prev, holiday_dates: holidays }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    try {
      setIsSaving(true);
      setError(null);

      const updateData: UpdateHolidaySettingsDto = {
        weekend_off: formData.weekend_off,
        holiday_dates: formData.holiday_dates,
      };

      const updatedSettings = await settingsApi.updateHolidaySettings(updateData);
      
      setSettings(updatedSettings);
      setFormData(updatedSettings);
      setHasUnsavedChanges(false);
      onSettingsUpdated?.(updatedSettings);

      // Show success message
      alert('設定を保存しました。');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`保存に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!settings) return;
    
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。リセットしてよろしいですか？')) {
        return;
      }
    }

    setFormData(settings);
    setHasUnsavedChanges(false);
    setError(null);
  };

  const handleReload = () => {
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。設定を再読み込みしてよろしいですか？')) {
        return;
      }
    }
    loadSettings();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">共通設定</h2>
              <p className="mt-1 text-sm text-gray-600">
                プロジェクト共通で使用される休日設定を管理します。
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleReload}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="設定を再読み込み"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <div className="text-red-700">{error}</div>
            <button
              onClick={handleReload}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              再試行
            </button>
          </div>
        )}

        <div className="px-6 py-6 space-y-8">
          {/* Weekend Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">土日の扱い</h3>
            <div className="bg-gray-50 p-4 rounded-md">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.weekend_off}
                  onChange={(e) => handleWeekendOffChange(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    土日を休日として扱う
                  </div>
                  <div className="text-xs text-gray-600">
                    チェックすると土曜日と日曜日がプロジェクトの休日として扱われます
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Holiday Dates */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">固定休日</h3>
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600 mb-4">
                年間を通じて休日として扱う日付を登録してください。
                国民の祝日、会社の創立記念日、年末年始などにご活用ください。
              </p>
              <HolidayDatePicker
                holidays={formData.holiday_dates}
                onChange={handleHolidayDatesChange}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Current Settings Summary */}
          {settings && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">現在の設定</h3>
              <div className="bg-blue-50 p-4 rounded-md space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">土日休み:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    formData.weekend_off 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {formData.weekend_off ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">固定休日:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formData.holiday_dates.length}件
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div>
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                未保存の変更があります
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleReset}
              disabled={!hasUnsavedChanges || isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              リセット
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              )}
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;