import type { Metadata } from 'next';
import GlobalSettings from '@/components/settings/GlobalSettings';

export const metadata: Metadata = {
  title: '共通設定 - Gantt Chart Web UI',
  description: 'プロジェクト共通で使用される設定を管理します',
};

/**
 * Global Settings Page
 * 
 * Features:
 * - Holiday settings management (weekend on/off, fixed holidays)
 * - Settings save/reset functionality
 * - Real-time validation and state management
 * 
 * API Integration:
 * - GET /api/settings/holidays - Load current settings
 * - PUT /api/settings/holidays - Update settings
 * 
 * Security:
 * - Requires Viewer role for reading settings
 * - Requires Editor role for updating settings
 * - Uses the same authentication middleware as other APIs
 */
export default function SettingsPage() {
  const handleSettingsUpdated = (settings: any) => {
    console.log('Settings updated:', settings);
    // Could trigger additional actions like refreshing other components
    // or showing notifications
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <nav className="flex" aria-label="パンくず">
              <ol className="flex items-center space-x-4">
                <li>
                  <div>
                    <a href="/" className="text-gray-400 hover:text-gray-500">
                      <svg
                        className="flex-shrink-0 h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                      <span className="sr-only">ホーム</span>
                    </a>
                  </div>
                </li>
                <li>
                  <div className="flex items-center">
                    <svg
                      className="flex-shrink-0 h-5 w-5 text-gray-300"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                    </svg>
                    <span className="ml-4 text-sm font-medium text-gray-500" aria-current="page">
                      共通設定
                    </span>
                  </div>
                </li>
              </ol>
            </nav>
          </div>

          <GlobalSettings onSettingsUpdated={handleSettingsUpdated} />
        </div>
      </div>
    </div>
  );
}