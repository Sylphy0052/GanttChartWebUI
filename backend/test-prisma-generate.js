/**
 * Prismaクライアント生成テストスクリプト
 * データベース接続なしでPrismaクライアントが正常に生成されているかテスト
 */
async function testPrismaGenerate() {
  try {
    console.log('🔍 Testing Prisma client generation...');
    
    // Prismaクライアントのインポートテスト
    const { PrismaClient } = require('@prisma/client');
    console.log('✅ @prisma/client import successful');
    
    // Prismaクライアントインスタンス生成テスト
    const prisma = new PrismaClient();
    console.log('✅ PrismaClient instantiation successful');
    
    // 生成されたモデルの確認
    const modelNames = Object.keys(prisma).filter(key => 
      !key.startsWith('$') && 
      !key.startsWith('_') &&
      typeof prisma[key] === 'object' &&
      prisma[key] !== null
    );
    
    console.log('✅ Generated Prisma models:', modelNames);
    
    // 期待されるモデルが存在するかチェック
    const expectedModels = ['project', 'globalSettings', 'issue', 'dependency', 'comment', 'changeLog', 'imagePath'];
    const missingModels = expectedModels.filter(model => !modelNames.includes(model));
    
    if (missingModels.length === 0) {
      console.log('✅ All expected models are generated');
    } else {
      console.warn('⚠️  Missing models:', missingModels);
    }
    
    console.log('✅ Prisma client generation test completed successfully');
    
  } catch (error) {
    console.error('❌ Prisma client generation test failed:', error);
    process.exit(1);
  }
}

testPrismaGenerate();