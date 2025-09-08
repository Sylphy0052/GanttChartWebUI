'use client';

import React, { useState } from 'react';

interface HolidayDatePickerProps {
  /** Current selected holiday dates in YYYY-MM-DD format */
  holidays: string[];
  /** Callback when holidays list is updated */
  onChange: (holidays: string[]) => void;
  /** Whether the component is in read-only mode */
  disabled?: boolean;
}

const HolidayDatePicker: React.FC<HolidayDatePickerProps> = ({
  holidays,
  onChange,
  disabled = false,
}) => {
  const [newDate, setNewDate] = useState('');

  const handleAddHoliday = () => {
    if (!newDate) return;
    
    // Check if date is already in the list
    if (holidays.includes(newDate)) {
      alert('この日付は既に登録されています。');
      return;
    }

    // Add new date and sort the list
    const updatedHolidays = [...holidays, newDate].sort();
    onChange(updatedHolidays);
    setNewDate('');
  };

  const handleRemoveHoliday = (dateToRemove: string) => {
    const updatedHolidays = holidays.filter(date => date !== dateToRemove);
    onChange(updatedHolidays);
  };

  const formatDateDisplay = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return dateString;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !disabled) {
      handleAddHoliday();
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new holiday section */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label 
            htmlFor="new-holiday-date" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            新しい休日を追加
          </label>
          <input
            id="new-holiday-date"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm"
            placeholder="YYYY-MM-DD"
          />
        </div>
        <button
          onClick={handleAddHoliday}
          disabled={disabled || !newDate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          追加
        </button>
      </div>

      {/* Holiday list */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          登録済み休日 ({holidays.length}件)
        </h4>
        
        {holidays.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-md">
            固定休日が登録されていません
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {holidays.map((holiday) => (
              <div
                key={holiday}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatDateDisplay(holiday)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {holiday}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveHoliday(holiday)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  title="削除"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {holidays.length > 0 && (
        <div className="text-xs text-gray-500">
          休日は日付順に自動で並び替えられます。
        </div>
      )}
    </div>
  );
};

export default HolidayDatePicker;