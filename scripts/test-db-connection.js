#!/usr/bin/env node

/**
 * Database Connection Testing Script
 * Tests PostgreSQL connection and verifies database accessibility
 */

const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  console.log('🔧 Testing database connection...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test basic connection
    console.log('📡 Attempting to connect to database...');
    await prisma.$connect();
    console.log('✅ Successfully connected to database!');
    
    // Test query execution
    console.log('🔍 Testing query execution...');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Query executed successfully!');
    console.log('📊 Database version:', result[0].version);
    
    // Test Prisma schema
    console.log('🏗️  Testing Prisma schema access...');
    const projectCount = await prisma.project.count();
    console.log(`✅ Schema accessible! Current project count: ${projectCount}`);
    
    console.log('🎉 All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:');
    console.error('Error details:', error.message);
    console.error('Database URL:', process.env.DATABASE_URL || 'Not set');
    process.exit(1);
    
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed.');
  }
}

// Run the test
testDatabaseConnection()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });