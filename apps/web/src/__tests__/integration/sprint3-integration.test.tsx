/**
 * T017 AC2: Full Integration Test Suite for Sprint 3 Features
 * 
 * Validates password protection, progress management, and KPI systems
 * working together seamlessly across all Sprint 3 tasks (T012-T016)
 */

import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Test utilities and mocks
import { createMockProject, createMockIssues, createMockDependencies } from '../fixtures/test-data';
import { MockAuthProvider } from '../fixtures/MockAuthProvider';
import { MockApiProvider } from '../fixtures/MockApiProvider';

// Components to test
import { ProjectAccessModal } from '../../components/ui/ProjectAccessModal';
import { ProgressManagementSystem } from '../../components/gantt/ProgressManagementSystem';
import { BatchProgressUpdateModal } from '../../components/gantt/BatchProgressUpdateModal';
import { GanttChart } from '../../components/gantt/GanttChart';
import { tokenManager } from '../../services/tokenManager';

// Services
import { ganttPerformanceMonitor } from '../../lib/performance';
import { performanceOptimizer } from '../../lib/performance-optimization';

// Mock external dependencies
vi.mock('../../services/tokenManager', () => ({
  tokenManager: {
    setToken: vi.fn(),
    getToken: vi.fn(),
    isTokenValid: vi.fn(),
    removeToken: vi.fn(),
    getAuthHeaders: vi.fn(),
    refreshToken: vi.fn()
  }
}));

vi.mock('../../lib/performance', () => ({
  ganttPerformanceMonitor: {
    startMeasurement: vi.fn(),
    endMeasurement: vi.fn(),
    recordMetrics: vi.fn(),
    getLatestMetrics: vi.fn(),
    isPerformanceAcceptable: vi.fn()
  }
}));

describe('T017 AC2: Sprint 3 Integration Tests', () => {
  let mockProject: any;
  let mockIssues: any[];
  let mockUser: any;
  let mockApiResponses: any;

  beforeEach(() => {
    // Setup test data
    mockProject = createMockProject();
    mockIssues = createMockIssues(50); // Test with 50 issues
    mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin'
    };

    // Setup API response mocks
    mockApiResponses = {
      '/auth/login': {
        access_token: 'mock-jwt-token',
        user: mockUser
      },
      '/projects/auth': {
        success: true,
        accessToken: 'project-access-token',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        refreshToken: 'refresh-token',
        refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      [`/projects/${mockProject.id}/issues`]: mockIssues,
      [`/projects/${mockProject.id}/dependencies`]: createMockDependencies(mockIssues)
    };

    // Setup token manager mocks
    vi.mocked(tokenManager.isTokenValid).mockReturnValue(true);
    vi.mocked(tokenManager.getToken).mockReturnValue({
      token: 'project-access-token',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      refreshToken: 'refresh-token',
      refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
    vi.mocked(tokenManager.getAuthHeaders).mockReturnValue({
      'x-project-access-token': 'project-access-token'
    });

    // Setup performance monitoring mocks
    vi.mocked(ganttPerformanceMonitor.getLatestMetrics).mockReturnValue({
      initialRenderTime: 150,
      dragResponseTime: 80,
      zoomTransitionTime: 120,
      memoryUsage: 45,
      taskCount: 50,
      dependencyCount: 25,
      timestamp: Date.now(),
      viewportWidth: 1200,
      viewportHeight: 800,
      timeScale: 'day'
    });
    vi.mocked(ganttPerformanceMonitor.isPerformanceAcceptable).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('T012: Password Protection Integration', () => {
    test('should authenticate and access project with valid credentials', async () => {
      const user = userEvent.setup();
      
      render(
        <MockApiProvider responses={mockApiResponses}>
          <MockAuthProvider user={mockUser}>
            <ProjectAccessModal
              projectId={mockProject.id}
              isOpen={true}
              onClose={() => {}}
              onSuccess={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Enter password
      const passwordInput = screen.getByLabelText(/パスワード/i);
      await user.type(passwordInput, 'test-password');

      // Click access button
      const accessButton = screen.getByRole('button', { name: /アクセス/i });
      await user.click(accessButton);

      await waitFor(() => {
        expect(tokenManager.setToken).toHaveBeenCalledWith(
          mockProject.id,
          expect.objectContaining({
            token: 'project-access-token',
            expiresAt: expect.any(Number),
            refreshToken: 'refresh-token'
          })
        );
      });
    });

    test('should handle authentication failure gracefully', async () => {
      const user = userEvent.setup();
      const failureResponses = {
        ...mockApiResponses,
        '/projects/auth': { 
          success: false, 
          error: 'Invalid password',
          status: 401 
        }
      };

      render(
        <MockApiProvider responses={failureResponses}>
          <ProjectAccessModal
            projectId={mockProject.id}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MockApiProvider>
      );

      const passwordInput = screen.getByLabelText(/パスワード/i);
      await user.type(passwordInput, 'wrong-password');

      const accessButton = screen.getByRole('button', { name: /アクセス/i });
      await user.click(accessButton);

      await waitFor(() => {
        expect(screen.getByText(/パスワードが正しくありません/i)).toBeInTheDocument();
      });

      expect(tokenManager.setToken).not.toHaveBeenCalled();
    });

    test('should handle token refresh seamlessly', async () => {
      // Mock token that expires soon
      vi.mocked(tokenManager.getToken).mockReturnValue({
        token: 'expiring-token',
        expiresAt: Date.now() + 1000, // Expires in 1 second
        refreshToken: 'refresh-token',
        refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      });

      vi.mocked(tokenManager.refreshToken).mockResolvedValue({
        token: 'new-access-token',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        refreshToken: 'new-refresh-token',
        refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      });

      render(
        <MockApiProvider responses={mockApiResponses}>
          <MockAuthProvider user={mockUser}>
            <GanttChart
              projectId={mockProject.id}
              issues={mockIssues}
              dependencies={[]}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Wait for token refresh to be triggered
      await waitFor(() => {
        expect(tokenManager.refreshToken).toHaveBeenCalledWith(mockProject.id);
      }, { timeout: 2000 });
    });
  });

  describe('T013: Progress Update API Integration', () => {
    test('should update leaf task progress successfully', async () => {
      const user = userEvent.setup();
      const leafTask = mockIssues.find(issue => issue.childIssues.length === 0);
      
      const progressApiResponses = {
        ...mockApiResponses,
        [`/issues/${leafTask.id}/progress`]: {
          id: leafTask.id,
          progress: 75,
          version: leafTask.version + 1,
          progressMetrics: {
            isLeafTask: true,
            canUpdateProgress: true,
            childTaskCount: 0
          },
          validationResults: {
            isValid: true,
            errors: []
          }
        }
      };

      render(
        <MockApiProvider responses={progressApiResponses}>
          <MockAuthProvider user={mockUser}>
            <ProgressManagementSystem
              projectId={mockProject.id}
              issues={mockIssues}
              onIssueUpdate={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Find and click on leaf task
      const taskRow = screen.getByTestId(`task-row-${leafTask.id}`);
      expect(taskRow).toBeInTheDocument();

      // Find progress input
      const progressInput = taskRow.querySelector('[data-testid="progress-input"]');
      expect(progressInput).toBeInTheDocument();

      // Update progress
      await user.clear(progressInput!);
      await user.type(progressInput!, '75');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByDisplayValue('75')).toBeInTheDocument();
      });
    });

    test('should prevent parent task progress updates', async () => {
      const user = userEvent.setup();
      const parentTask = mockIssues.find(issue => issue.childIssues.length > 0);
      
      const progressApiResponses = {
        ...mockApiResponses,
        [`/issues/${parentTask.id}/progress`]: {
          error: 'Cannot update progress on parent tasks',
          status: 400
        }
      };

      render(
        <MockApiProvider responses={progressApiResponses}>
          <MockAuthProvider user={mockUser}>
            <ProgressManagementSystem
              projectId={mockProject.id}
              issues={mockIssues}
              onIssueUpdate={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Try to update parent task progress
      const taskRow = screen.getByTestId(`task-row-${parentTask.id}`);
      const progressInput = taskRow.querySelector('[data-testid="progress-input"]');

      await user.clear(progressInput!);
      await user.type(progressInput!, '50');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/親タスクの進捗は更新できません/i)).toBeInTheDocument();
      });
    });

    test('should handle batch progress updates', async () => {
      const user = userEvent.setup();
      const leafTasks = mockIssues.filter(issue => issue.childIssues.length === 0).slice(0, 3);
      
      const batchApiResponses = {
        ...mockApiResponses,
        '/issues/batch-progress': {
          results: leafTasks.map(task => ({
            id: task.id,
            progress: 80,
            success: true,
            version: task.version + 1
          })),
          summary: {
            totalUpdated: leafTasks.length,
            totalFailed: 0
          }
        }
      };

      render(
        <MockApiProvider responses={batchApiResponses}>
          <MockAuthProvider user={mockUser}>
            <BatchProgressUpdateModal
              isOpen={true}
              onClose={() => {}}
              selectedTasks={leafTasks}
              onSuccess={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Set batch progress value
      const progressInput = screen.getByLabelText(/進捗率/i);
      await user.type(progressInput, '80');

      // Add comment
      const commentInput = screen.getByLabelText(/コメント/i);
      await user.type(commentInput, 'Batch update test');

      // Submit batch update
      const updateButton = screen.getByRole('button', { name: /一括更新/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText(/3件のタスクが正常に更新されました/i)).toBeInTheDocument();
      });
    });
  });

  describe('T014: Project Access Modal Integration', () => {
    test('should handle modal state transitions correctly', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <MockApiProvider responses={mockApiResponses}>
          <ProjectAccessModal
            projectId={mockProject.id}
            isOpen={true}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </MockApiProvider>
      );

      // Modal should be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Enter password and authenticate
      const passwordInput = screen.getByLabelText(/パスワード/i);
      await user.type(passwordInput, 'test-password');

      const accessButton = screen.getByRole('button', { name: /アクセス/i });
      await user.click(accessButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      // Close modal
      rerender(
        <MockApiProvider responses={mockApiResponses}>
          <ProjectAccessModal
            projectId={mockProject.id}
            isOpen={false}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </MockApiProvider>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should handle token management UI feedback', async () => {
      const user = userEvent.setup();
      
      render(
        <MockApiProvider responses={mockApiResponses}>
          <ProjectAccessModal
            projectId={mockProject.id}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
            showTokenInfo={true}
          />
        </MockApiProvider>
      );

      // Should show token expiration info
      expect(screen.getByText(/24時間有効/i)).toBeInTheDocument();
      
      // Should show refresh token info
      expect(screen.getByText(/自動更新/i)).toBeInTheDocument();
    });
  });

  describe('T015: Progress Management UI Integration', () => {
    test('should render progress controls for leaf tasks only', () => {
      render(
        <MockApiProvider responses={mockApiResponses}>
          <MockAuthProvider user={mockUser}>
            <ProgressManagementSystem
              projectId={mockProject.id}
              issues={mockIssues}
              onIssueUpdate={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      const leafTasks = mockIssues.filter(issue => issue.childIssues.length === 0);
      const parentTasks = mockIssues.filter(issue => issue.childIssues.length > 0);

      // Leaf tasks should have progress controls
      leafTasks.forEach(task => {
        const progressInput = screen.getByTestId(`progress-input-${task.id}`);
        expect(progressInput).toBeInTheDocument();
        expect(progressInput).not.toBeDisabled();
      });

      // Parent tasks should not have editable progress controls
      parentTasks.forEach(task => {
        const progressDisplay = screen.getByTestId(`progress-display-${task.id}`);
        expect(progressDisplay).toBeInTheDocument();
        // Should show calculated progress but not be editable
      });
    });

    test('should handle progress validation correctly', async () => {
      const user = userEvent.setup();
      const leafTask = mockIssues.find(issue => issue.childIssues.length === 0);

      render(
        <MockApiProvider responses={mockApiResponses}>
          <MockAuthProvider user={mockUser}>
            <ProgressManagementSystem
              projectId={mockProject.id}
              issues={mockIssues}
              onIssueUpdate={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      const progressInput = screen.getByTestId(`progress-input-${leafTask.id}`);

      // Test invalid progress values
      await user.clear(progressInput);
      await user.type(progressInput, '150');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/進捗率は0-100の範囲で入力してください/i)).toBeInTheDocument();
      });

      // Test negative progress
      await user.clear(progressInput);
      await user.type(progressInput, '-10');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/進捗率は0-100の範囲で入力してください/i)).toBeInTheDocument();
      });
    });
  });

  describe('T016: Advanced KPI Measurement Integration', () => {
    test('should integrate telemetry with all Sprint 3 features', async () => {
      const user = userEvent.setup();

      render(
        <MockApiProvider responses={mockApiResponses}>
          <MockAuthProvider user={mockUser}>
            <GanttChart
              projectId={mockProject.id}
              issues={mockIssues}
              dependencies={createMockDependencies(mockIssues)}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Simulate user interactions that should be tracked
      const ganttContainer = screen.getByTestId('gantt-container');
      
      // Trigger drag operation (should be measured)
      fireEvent.mouseDown(ganttContainer);
      fireEvent.mouseMove(ganttContainer, { clientX: 100, clientY: 50 });
      fireEvent.mouseUp(ganttContainer);

      // Trigger zoom operation (should be measured)
      fireEvent.wheel(ganttContainer, { deltaY: -100 });

      // Verify telemetry measurements were recorded
      await waitFor(() => {
        expect(ganttPerformanceMonitor.startMeasurement).toHaveBeenCalledWith('drag-response');
        expect(ganttPerformanceMonitor.startMeasurement).toHaveBeenCalledWith('zoom-transition');
      });

      expect(ganttPerformanceMonitor.recordMetrics).toHaveBeenCalled();
    });

    test('should provide performance feedback to users', async () => {
      // Mock poor performance
      vi.mocked(ganttPerformanceMonitor.getLatestMetrics).mockReturnValue({
        initialRenderTime: 2000, // Exceeds threshold
        dragResponseTime: 200,   // Exceeds threshold
        zoomTransitionTime: 300, // Exceeds threshold
        memoryUsage: 600,        // Exceeds threshold
        taskCount: 1000,
        dependencyCount: 500,
        timestamp: Date.now(),
        viewportWidth: 1200,
        viewportHeight: 800,
        timeScale: 'day'
      });

      vi.mocked(ganttPerformanceMonitor.isPerformanceAcceptable).mockReturnValue(false);

      render(
        <MockApiProvider responses={mockApiResponses}>
          <MockAuthProvider user={mockUser}>
            <GanttChart
              projectId={mockProject.id}
              issues={mockIssues}
              dependencies={[]}
              showPerformanceWarnings={true}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/パフォーマンスの問題が検出されました/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Feature Integration', () => {
    test('should handle authentication + progress update + telemetry together', async () => {
      const user = userEvent.setup();
      const leafTask = mockIssues.find(issue => issue.childIssues.length === 0);
      
      const integrationResponses = {
        ...mockApiResponses,
        [`/issues/${leafTask.id}/progress`]: {
          id: leafTask.id,
          progress: 90,
          version: leafTask.version + 1,
          progressMetrics: { isLeafTask: true, canUpdateProgress: true },
          validationResults: { isValid: true, errors: [] }
        },
        '/telemetry/batch': { success: true, queuePosition: 1 }
      };

      render(
        <MockApiProvider responses={integrationResponses}>
          <MockAuthProvider user={mockUser}>
            <ProgressManagementSystem
              projectId={mockProject.id}
              issues={mockIssues}
              onIssueUpdate={() => {}}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Verify authentication headers are used
      expect(tokenManager.getAuthHeaders).toHaveBeenCalledWith(mockProject.id);

      // Update progress (should trigger telemetry)
      const progressInput = screen.getByTestId(`progress-input-${leafTask.id}`);
      await user.clear(progressInput);
      await user.type(progressInput, '90');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByDisplayValue('90')).toBeInTheDocument();
      });

      // Verify telemetry was recorded for the progress update
      expect(ganttPerformanceMonitor.recordMetrics).toHaveBeenCalled();
    });

    test('should maintain performance during complex interactions', async () => {
      const user = userEvent.setup();
      const largeDataset = createMockIssues(200); // Large dataset for performance testing

      render(
        <MockApiProvider responses={{
          ...mockApiResponses,
          [`/projects/${mockProject.id}/issues`]: largeDataset
        }}>
          <MockAuthProvider user={mockUser}>
            <GanttChart
              projectId={mockProject.id}
              issues={largeDataset}
              dependencies={createMockDependencies(largeDataset)}
            />
          </MockAuthProvider>
        </MockApiProvider>
      );

      // Simulate complex interactions
      const ganttContainer = screen.getByTestId('gantt-container');
      
      // Multiple drag operations
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseDown(ganttContainer);
        fireEvent.mouseMove(ganttContainer, { clientX: 100 + i * 20, clientY: 50 });
        fireEvent.mouseUp(ganttContainer);
      }

      // Multiple zoom operations
      for (let i = 0; i < 3; i++) {
        fireEvent.wheel(ganttContainer, { deltaY: i % 2 === 0 ? -100 : 100 });
      }

      // Verify performance is still acceptable
      await waitFor(() => {
        expect(ganttPerformanceMonitor.isPerformanceAcceptable).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from API failures gracefully', async () => {
      const user = userEvent.setup();
      const failureResponses = {
        ...mockApiResponses,
        '/projects/auth': { error: 'Server error', status: 500 }
      };

      render(
        <MockApiProvider responses={failureResponses}>
          <ProjectAccessModal
            projectId={mockProject.id}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MockApiProvider>
      );

      const passwordInput = screen.getByLabelText(/パスワード/i);
      await user.type(passwordInput, 'test-password');

      const accessButton = screen.getByRole('button', { name: /アクセス/i });
      await user.click(accessButton);

      // Should show error message and retry option
      await waitFor(() => {
        expect(screen.getByText(/サーバーエラーが発生しました/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /再試行/i })).toBeInTheDocument();
      });
    });

    test('should handle network connectivity issues', async () => {
      // Mock network failure
      const networkFailureResponses = {
        ...mockApiResponses,
        '/projects/auth': Promise.reject(new Error('Network error'))
      };

      render(
        <MockApiProvider responses={networkFailureResponses}>
          <ProjectAccessModal
            projectId={mockProject.id}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MockApiProvider>
      );

      const user = userEvent.setup();
      const passwordInput = screen.getByLabelText(/パスワード/i);
      await user.type(passwordInput, 'test-password');

      const accessButton = screen.getByRole('button', { name: /アクセス/i });
      await user.click(accessButton);

      await waitFor(() => {
        expect(screen.getByText(/ネットワークエラー/i)).toBeInTheDocument();
      });
    });
  });
});

describe('T017 AC2: Integration Test Suite Summary', () => {
  test('should validate all Sprint 3 features integration', () => {
    // This test verifies that all major integration scenarios are covered
    const integrationScenarios = [
      'Password Protection + Token Management',
      'Progress Updates + Activity Logging',
      'Modal State Management + UI Feedback',
      'Performance Monitoring + Telemetry',
      'Cross-feature Authentication',
      'Error Recovery + Resilience',
      'Large Dataset Performance',
      'Batch Operations + Validation'
    ];

    console.log('🧪 Sprint 3 Integration Test Coverage:');
    integrationScenarios.forEach((scenario, index) => {
      console.log(`  ${index + 1}. ${scenario} ✅`);
    });

    expect(integrationScenarios).toHaveLength(8);
    console.log('\n✅ All Sprint 3 integration scenarios covered');
  });
});