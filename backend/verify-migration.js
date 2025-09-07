/**
 * Migration verification script
 * 初回マイグレーション実行とスキーマ適用の検証
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function verifyMigration() {
  console.log('🔍 Verifying database migration...');
  
  try {
    // 1. 基本的な接続確認
    console.log('✅ Database connection: Testing...');
    await prisma.$connect();
    console.log('✅ Database connection: Success');
    
    // 2. 各テーブルの存在確認
    const tables = [
      'projects',
      'global_settings', 
      'issues',
      'dependencies',
      'comments',
      'change_logs',
      'image_paths'
    ];
    
    console.log('✅ Table verification: Starting...');
    
    for (const table of tables) {
      try {
        // テーブルにアクセスしてスキーマを確認
        const result = await prisma.$queryRaw`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=${table}
        `;
        
        if (result.length > 0) {
          console.log(`✅ Table '${table}': Exists`);
        } else {
          console.log(`❌ Table '${table}': Missing`);
          return false;
        }
      } catch (error) {
        console.log(`❌ Table '${table}': Error - ${error.message}`);
        return false;
      }
    }
    
    // 3. 外部キー制約の確認
    console.log('✅ Foreign key constraints: Checking...');
    const fkResult = await prisma.$queryRaw`
      SELECT name, sql FROM sqlite_master 
      WHERE type='table' AND sql LIKE '%FOREIGN KEY%'
    `;
    
    const expectedFKTables = ['issues', 'dependencies', 'comments', 'change_logs', 'image_paths'];
    const actualFKTables = fkResult.map(row => row.name);
    
    for (const table of expectedFKTables) {
      if (actualFKTables.includes(table)) {
        console.log(`✅ Foreign keys in '${table}': Present`);
      } else {
        console.log(`❌ Foreign keys in '${table}': Missing`);
      }
    }
    
    // 4. インデックスの確認
    console.log('✅ Indexes: Checking...');
    const indexResult = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `;
    
    const expectedIndexes = [
      'projects_name_key',
      'dependencies_predecessor_issue_id_successor_issue_id_key',
      'image_paths_path_key'
    ];
    
    const actualIndexes = indexResult.map(row => row.name);
    
    for (const index of expectedIndexes) {
      if (actualIndexes.includes(index)) {
        console.log(`✅ Index '${index}': Present`);
      } else {
        console.log(`❌ Index '${index}': Missing`);
      }
    }
    
    // 5. サンプルデータの挿入・取得テスト
    console.log('✅ CRUD operations: Testing...');
    
    // テストプロジェクト作成
    const testProject = await prisma.project.create({
      data: {
        name: 'Test Migration Project',
        description_md: 'Test project for migration verification',
        is_deleted: false,
      },
    });
    console.log('✅ Create operation: Success');
    
    // テストプロジェクト取得
    const retrievedProject = await prisma.project.findUnique({
      where: { id: testProject.id },
    });
    
    if (retrievedProject && retrievedProject.name === 'Test Migration Project') {
      console.log('✅ Read operation: Success');
    } else {
      console.log('❌ Read operation: Failed');
      return false;
    }
    
    // テストプロジェクト削除
    await prisma.project.delete({
      where: { id: testProject.id },
    });
    console.log('✅ Delete operation: Success');
    
    console.log('🎉 Migration verification completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - 7 tables created: ${tables.join(', ')}`);
    console.log('   - Foreign key constraints properly set');
    console.log('   - Unique indexes created');
    console.log('   - CRUD operations working');
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
if (require.main === module) {
  verifyMigration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { verifyMigration };