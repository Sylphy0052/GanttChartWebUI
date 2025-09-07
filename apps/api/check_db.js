const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('Checking database connection...');
    
    // Check users
    const users = await prisma.user.findMany({
      take: 3,
      select: { id: true, email: true, name: true }
    });
    console.log('Available users:', users);
    
    // Check projects
    const projects = await prisma.project.findMany({
      take: 3,
      select: { id: true, name: true }
    });
    console.log('Available projects:', projects);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
