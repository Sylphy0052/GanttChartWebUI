const { NestFactory } = require('@nestjs/core');

// Minimal test to check if NestJS can load our module
console.log('Testing simple NestJS loading...');

// Simple test without TypeScript
const { AppModule } = require('./dist/app.module.js');

async function test() {
  try {
    const app = await NestFactory.create(AppModule);
    console.log('✅ NestJS app creation successful');
    
    await app.listen(3001);
    console.log('✅ Server listening on port 3001');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();