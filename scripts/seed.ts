/*
  Seed script for PoC
  - Project 1件
  - Users 5件（ダミー）
  - Issues ~1,000件（WBS: 深さ3/幅5 ≒ 155件 + フラットで埋め）
  - Dependencies: FS をランダム（DAG保証）
  - カレンダー: 平日稼働（祝日考慮なし）
*/
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// ===== Utility =====
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: T[]) => arr[rand(0, arr.length - 1)]

function isWorkday(d: Date) {
  const day = d.getDay();
  return day !== 0 && day !== 6; // Mon-Fri
}

function addWorkdays(base: Date, n: number) {
  const d = new Date(base)
  const step = n >= 0 ? 1 : -1
  let remain = Math.abs(n)
  while (remain > 0) {
    d.setDate(d.getDate() + step)
    if (isWorkday(d)) remain--
  }
  return d
}

function nextWorkday(d: Date) {
  const x = new Date(d)
  while (!isWorkday(x)) x.setDate(x.getDate() + 1)
  return x
}

// ===== Config =====
const TOTAL_ISSUES = 1000
const TREE_DEPTH = 3
const BRANCHING = 5
const USERS = [
  { id: randomUUID(), name: '佐藤' },
  { id: randomUUID(), name: '鈴木' },
  { id: randomUUID(), name: '田中' },
  { id: randomUUID(), name: '高橋' },
  { id: randomUUID(), name: '伊藤' },
]
const LABELS = ['frontend','backend','infra','bug','feature','urgent','lowrisk']
const TYPES = ['feature','bug','spike','chore']
const STATUSES = ['todo','doing','blocked','review','done']

// ===== Main =====
async function main() {
  console.time('seed')
  
  // Clean (dev only)
  await prisma.$transaction([
    prisma.activityLog.deleteMany({}),
    prisma.dependency.deleteMany({}),
    prisma.issue.deleteMany({}),
    prisma.calendar.deleteMany({}),
    prisma.project.deleteMany({}),
  ])

  const project = await prisma.project.create({ data: { name: 'PoC Project' } })
  
  // Create default calendar
  await prisma.calendar.create({
    data: {
      projectId: project.id,
      name: 'Default',
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
      holidays: [],
      dailyHours: 8
    }
  })

  // Create hierarchical issues first (depth 3, branching 5)
  const created: { id: string; isLeaf: boolean }[] = []

  let counter = 1
  async function createIssue(parentId: string | null, depth: number): Promise<string> {
    const title = parentId ? `Issue ${counter} (d${depth})` : `Root Epic`
    counter++
    const today = new Date()
    const start = nextWorkday(addWorkdays(today, rand(0, 20)))
    const durationDays = rand(1, 10)
    const due = addWorkdays(start, durationDays - 1)
    const status = pick(STATUSES)
    const done = status === 'done'
    const progress = done ? 100 : rand(0, 90)

    const issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        parentIssueId: parentId,
        title,
        description: 'Auto seeded',
        status,
        type: pick(TYPES),
        priority: rand(1, 10),
        estimateValue: rand(4, 40), // hours
        estimateUnit: 'h',
        spent: rand(0, 20),
        assigneeId: pick(USERS).id,
        startDate: start,
        dueDate: due,
        progress,
        labels: Array.from(new Set([pick(LABELS), pick(LABELS)])).slice(0, rand(0,2)),
      },
      select: { id: true },
    })

    const isLeaf = depth === TREE_DEPTH
    created.push({ id: issue.id, isLeaf })

    if (!isLeaf) {
      for (let i = 0; i < BRANCHING; i++) {
        await createIssue(issue.id, depth + 1)
      }
    }
    return issue.id
  }

  // Root → depth 3 tree (~1 + 5 + 25 + 125 = 156)
  await createIssue(null, 0)

  // Fill the rest as flat tasks under root (parent=null) to reach TOTAL_ISSUES
  const toCreateFlat = Math.max(0, TOTAL_ISSUES - created.length)
  const today = new Date()
  const flatBatch = Array.from({ length: toCreateFlat }).map((_, i) => {
    const start = nextWorkday(addWorkdays(today, rand(0, 20)))
    const durationDays = rand(1, 10)
    const due = addWorkdays(start, durationDays - 1)
    const status = pick(STATUSES)
    const done = status === 'done'
    return {
      id: randomUUID(),
      projectId: project.id,
      parentIssueId: null as string | null,
      title: `Flat Issue ${i + 1}`,
      description: 'Auto seeded (flat)',
      status,
      type: pick(TYPES),
      priority: rand(1, 10),
      estimateValue: rand(4, 40),
      estimateUnit: 'h',
      spent: rand(0, 20),
      assigneeId: pick(USERS).id,
      startDate: start,
      dueDate: due,
      progress: done ? 100 : rand(0, 90),
      labels: Array.from(new Set([pick(LABELS), pick(LABELS)])).slice(0, rand(0,2)),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })

  // Bulk insert flats in chunks
  const CHUNK = 200
  for (let i = 0; i < flatBatch.length; i += CHUNK) {
    await prisma.issue.createMany({ data: flatBatch.slice(i, i + CHUNK) })
  }

  // Collect all issues for dependency creation (only leaves + some flats)
  const allIssues = await prisma.issue.findMany({
    where: { projectId: project.id },
    select: { id: true, parentIssueId: true },
    orderBy: { createdAt: 'asc' },
  })
  const idIndex = new Map(allIssues.map((it, idx) => [it.id, idx]))

  // Make DAG edges: successor index > predecessor index to avoid cycles
  const deps: { projectId: string; predecessorId: string; successorId: string; type: string; lag: number }[] = []
  const maxEdges = Math.floor(allIssues.length * 0.3) // density control (lower than spec for performance)
  
  for (let i = 1; i < allIssues.length && deps.length < maxEdges; i++) {
    // each node may depend on 0..2 previous nodes
    const num = rand(0, 2)
    for (let k = 0; k < num; k++) {
      const j = rand(0, i - 1)
      if (j === i) continue
      const a = allIssues[j].id
      const b = allIssues[i].id
      // avoid parent-child direct dependency to keep it simple
      const parentChild = allIssues[i].parentIssueId === a || allIssues[j].parentIssueId === b
      if (parentChild) continue
      deps.push({ projectId: project.id, predecessorId: a, successorId: b, type: 'FS', lag: 0 })
    }
  }

  // Insert dependencies in chunks, ignoring duplicates by unique constraint
  for (let i = 0; i < deps.length; i += CHUNK) {
    await prisma.dependency.createMany({ data: deps.slice(i, i + CHUNK), skipDuplicates: true })
  }

  console.log(`Project: ${project.id}`)
  const counts = await Promise.all([
    prisma.issue.count({ where: { projectId: project.id } }),
    prisma.dependency.count({ where: { projectId: project.id } }),
  ])
  console.log(`Issues: ${counts[0]}, Dependencies: ${counts[1]}`)
  console.timeEnd('seed')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })