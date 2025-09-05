export const testProjects = {
  basic: {
    id: 'test-project-basic',
    name: 'Basic Test Project',
    visibility: 'private',
    issueCount: 10,
    description: 'A basic test project for E2E testing'
  },
  advanced: {
    id: 'test-project-advanced',
    name: 'Advanced Test Project',
    visibility: 'private',
    issueCount: 50,
    dependencies: 5,
    milestones: 3,
    description: 'An advanced test project with complex structure'
  }
}

export const testIssues = [
  {
    id: 'issue-001',
    title: 'Test Task Alpha',
    description: 'First test task for E2E testing',
    status: 'open',
    type: 'task',
    priority: 5,
    assignee: 'test-user',
    estimate: '4h',
    startDate: '2025-09-01',
    dueDate: '2025-09-05'
  },
  {
    id: 'issue-002',
    title: 'Test Task Beta',
    description: 'Second test task with dependencies',
    status: 'in-progress',
    type: 'feature',
    priority: 8,
    assignee: 'test-user',
    estimate: '8h',
    startDate: '2025-09-03',
    dueDate: '2025-09-10'
  },
  {
    id: 'issue-003',
    title: 'Test Bug Fix',
    description: 'Test bug fixing task',
    status: 'closed',
    type: 'bug',
    priority: 3,
    assignee: 'test-user',
    estimate: '2h',
    startDate: '2025-08-28',
    dueDate: '2025-08-30'
  }
]

export const testDependencies = [
  {
    id: 'dep-001',
    predecessorId: 'issue-001',
    successorId: 'issue-002',
    type: 'FS',
    lag: 0
  }
]

export const testMilestones = [
  {
    id: 'milestone-001',
    title: 'Alpha Release',
    date: '2025-09-15',
    description: 'First major milestone'
  },
  {
    id: 'milestone-002',
    title: 'Beta Release',
    date: '2025-10-15',
    description: 'Second major milestone'
  }
]