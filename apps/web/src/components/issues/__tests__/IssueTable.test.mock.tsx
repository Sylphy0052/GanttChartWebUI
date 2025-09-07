// Test file to validate IssueTable implementation
// This would be a proper test file in a real scenario

import { IssueTable } from '../IssueTable'
import { Issue } from '@/types/issue'

// Mock data for testing
export const mockIssues: Issue[] = [
  {
    id: '1',
    projectId: 'proj-1',
    title: 'Implement user authentication',
    description: 'Add login functionality with JWT tokens',
    status: 'doing',
    type: 'feature',
    priority: 80,
    estimateValue: 8,
    estimateUnit: 'h',
    spent: 4,
    assigneeId: 'user1',
    startDate: '2025-09-01T00:00:00Z',
    dueDate: '2025-09-10T00:00:00Z',
    progress: 50,
    labels: ['auth', 'security'],
    version: 1,
    createdAt: '2025-09-01T00:00:00Z',
    updatedAt: '2025-09-06T00:00:00Z'
  },
  {
    id: '2',
    projectId: 'proj-1',
    title: 'Fix memory leak in worker threads',
    description: 'Memory usage keeps growing during batch processing',
    status: 'todo',
    type: 'bug',
    priority: 90,
    estimateValue: 4,
    estimateUnit: 'h',
    spent: 0,
    assigneeId: 'user2',
    startDate: '2025-09-07T00:00:00Z',
    dueDate: '2025-09-08T00:00:00Z',
    progress: 0,
    labels: ['performance', 'bug'],
    version: 1,
    createdAt: '2025-09-06T00:00:00Z',
    updatedAt: '2025-09-06T00:00:00Z'
  },
  {
    id: '3',
    projectId: 'proj-1',
    title: 'Research GraphQL implementation',
    description: 'Evaluate GraphQL vs REST for our API',
    status: 'review',
    type: 'spike',
    priority: 30,
    estimateValue: 2,
    estimateUnit: 'd',
    spent: 12,
    assigneeId: 'user3',
    startDate: '2025-09-01T00:00:00Z',
    dueDate: '2025-09-05T00:00:00Z',
    progress: 80,
    labels: ['research', 'api'],
    version: 1,
    createdAt: '2025-08-30T00:00:00Z',
    updatedAt: '2025-09-05T00:00:00Z'
  }
]

// Test scenarios that should work:
// 1. Render table with mock data
// 2. Filter by status (todo, doing, review)
// 3. Filter by assignee (user1, user2, user3)
// 4. Filter by priority (high: 80+, medium: 50-79, low: 0-49)
// 5. Search by title/description
// 6. Click row to open detail panel
// 7. Edit issue in detail panel
// 8. Delete issue with confirmation

export const testScenarios = [
  'Load issues table with 3 mock issues',
  'Filter by status="doing" should show 1 issue',
  'Filter by priority="high" should show 2 issues (80, 90)',
  'Search "auth" should show 1 issue',
  'Click row should open detail panel',
  'Edit title in panel and save should update issue',
  'Delete issue should show confirmation dialog'
]

export default mockIssues