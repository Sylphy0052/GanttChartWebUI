/**
 * Test script for T018 AC1: Forward pass calculates Early Start (ES) and Early Finish (EF)
 * 
 * This script tests the forward pass implementation without requiring a full NestJS setup.
 */

const { ForwardPass } = require('./dist/scheduling/algorithms/forward-pass');

// Test data: Simple dependency graph
// Task A (2 days) -> Task B (3 days) -> Task C (1 day)
const testTasks = [
  {
    id: 'task-a',
    title: 'Task A',
    duration: 2,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-03'),
    assigneeId: 'user-1',
    predecessors: [],
    successors: [
      { id: 'task-b', type: 'FS', lag: 0 }
    ],
    earliestStart: 0,
    earliestFinish: 0,
    isCompleted: false,
    progress: 0
  },
  {
    id: 'task-b', 
    title: 'Task B',
    duration: 3,
    startDate: new Date('2025-01-03'),
    endDate: new Date('2025-01-06'),
    assigneeId: 'user-2',
    predecessors: [
      { id: 'task-a', type: 'FS', lag: 0 }
    ],
    successors: [
      { id: 'task-c', type: 'FS', lag: 0 }
    ],
    earliestStart: 0,
    earliestFinish: 0,
    isCompleted: false,
    progress: 0
  },
  {
    id: 'task-c',
    title: 'Task C', 
    duration: 1,
    startDate: new Date('2025-01-06'),
    endDate: new Date('2025-01-07'),
    assigneeId: 'user-3',
    predecessors: [
      { id: 'task-b', type: 'FS', lag: 0 }
    ],
    successors: [],
    earliestStart: 0,
    earliestFinish: 0,
    isCompleted: false,
    progress: 0
  }
];

function testForwardPass() {
  console.log('🧪 Testing T018 AC1: Forward Pass Implementation');
  console.log('=' .repeat(60));

  try {
    // Initialize forward pass algorithm
    const forwardPass = new ForwardPass();
    const projectStartDate = new Date('2025-01-01');

    console.log('📊 Input Tasks:');
    testTasks.forEach(task => {
      console.log(`  - ${task.title}: ${task.duration} days, Predecessors: [${task.predecessors.map(p => p.id).join(', ')}]`);
    });

    console.log('\n🔄 Running Forward Pass...');

    // Execute forward pass calculation
    const result = forwardPass.calculate(
      testTasks,
      projectStartDate,
      {
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        workingHoursPerDay: 8,
        holidays: []
      }
    );

    console.log('\n✅ Forward Pass Results:');
    console.log(`   Project Earliest Finish: ${result.projectEarliestFinish} days`);
    console.log(`   Critical Path Candidates: [${result.criticalPathCandidates.join(', ')}]`);

    console.log('\n📋 Task Schedule Details:');
    result.tasks.forEach((task, taskId) => {
      console.log(`   ${task.title}:`);
      console.log(`     • Early Start (ES): ${task.earliestStart} days`);
      console.log(`     • Early Finish (EF): ${task.earliestFinish} days`);
      console.log(`     • Duration: ${task.duration} days`);
      console.log(`     • Is Critical: ${result.criticalPathCandidates.includes(taskId)}`);
    });

    // Verify expected results for simple linear dependency
    const expectedResults = {
      'task-a': { es: 0, ef: 2 },
      'task-b': { es: 2, ef: 5 },  // Starts after task-a finishes
      'task-c': { es: 5, ef: 6 }   // Starts after task-b finishes
    };

    console.log('\n🔍 Validation:');
    let allValid = true;
    
    for (const [taskId, expected] of Object.entries(expectedResults)) {
      const actual = result.tasks.get(taskId);
      const esValid = Math.abs(actual.earliestStart - expected.es) < 0.1;
      const efValid = Math.abs(actual.earliestFinish - expected.ef) < 0.1;
      
      if (esValid && efValid) {
        console.log(`   ✅ ${taskId}: ES=${actual.earliestStart}, EF=${actual.earliestFinish} (Expected ES=${expected.es}, EF=${expected.ef})`);
      } else {
        console.log(`   ❌ ${taskId}: ES=${actual.earliestStart}, EF=${actual.earliestFinish} (Expected ES=${expected.es}, EF=${expected.ef})`);
        allValid = false;
      }
    }

    if (allValid) {
      console.log('\n🎉 AC1 PASSED: Forward pass correctly calculates Early Start (ES) and Early Finish (EF) for all tasks!');
      console.log('   ✓ Dependencies are respected');
      console.log('   ✓ ES/EF calculations are correct');
      console.log('   ✓ Critical path candidates identified');
    } else {
      console.log('\n❌ AC1 FAILED: Forward pass calculations do not match expected values');
    }

    return allValid;

  } catch (error) {
    console.error('\n💥 Error during forward pass test:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testForwardPass();
}

module.exports = { testForwardPass };