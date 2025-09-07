const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testIssueCreation() {
  try {
    console.log('Testing direct issue creation...');
    
    const projectId = '597586ec-cb5a-45d3-a3f6-842650618230';
    const userId = '3ed589d3-1f6a-4b2a-8240-37442aa3a679';
    
    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true }
    });
    console.log('Project found:', project);
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });
    console.log('User found:', user);
    
    // Try to create an issue
    const issue = await prisma.issue.create({
      data: {
        title: 'Test Webhook Issue',
        description: 'Created via webhook test',
        status: 'todo',
        priority: 5,
        type: 'task',
        estimateValue: 1,
        estimateUnit: 'h',
        projectId: projectId,
        createdById: userId,
        assigneeId: userId,
        labels: ['feature', 'webhook-test']
      }
    });
    
    console.log('Issue created successfully:', issue.id);
    
    // Clean up - delete the test issue
    await prisma.issue.delete({
      where: { id: issue.id }
    });
    console.log('Test issue deleted');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testIssueCreation();
