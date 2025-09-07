const { PrismaClient } = require('@prisma/client');

/**
 * データベース接続テストスクリプト
 * Usage: node test-db-connection.js
 */
async function testDatabaseConnection() {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    console.log('🔍 Testing database connection...');
    
    // 接続テスト
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // 簡単なクエリテスト
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query execution successful:', result);
    
    // Prismaクライアントが生成されているかテスト
    console.log('✅ Prisma client available models:', Object.keys(prisma).filter(key => 
      !key.startsWith('$') && !key.startsWith('_')
    ));
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

testDatabaseConnection();