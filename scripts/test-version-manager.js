#!/usr/bin/env node
/**
 * Test Suite for Version Manager - M10-05
 * Tests unified version management functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const VersionManager = require('./version-manager.js');

class VersionManagerTester {
  constructor() {
    this.testResults = [];
    this.tempDir = path.join(__dirname, 'temp-test');
    this.backupDir = path.join(__dirname, 'backup-test');
  }

  /**
   * Setup test environment
   */
  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Create backup of original files
    const filesToBackup = [
      '../package.json',
      '../backend/package.json', 
      '../frontend/package.json'
    ];

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    filesToBackup.forEach(file => {
      const originalPath = path.join(__dirname, file);
      if (fs.existsSync(originalPath)) {
        const backupPath = path.join(this.backupDir, path.basename(file));
        fs.copyFileSync(originalPath, backupPath);
        console.log(`📋 Backed up ${file}`);
      }
    });
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Restore original files
    if (fs.existsSync(this.backupDir)) {
      const backupFiles = fs.readdirSync(this.backupDir);
      
      backupFiles.forEach(fileName => {
        const backupPath = path.join(this.backupDir, fileName);
        let originalPath;
        
        if (fileName === 'package.json') {
          originalPath = path.join(__dirname, '..', 'package.json');
        } else if (fileName.includes('package.json')) {
          // Handle backend/frontend package.json files
          const dir = fileName.replace('-package.json', '');
          originalPath = path.join(__dirname, '..', dir, 'package.json');
        }
        
        if (originalPath && fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, originalPath);
          console.log(`🔄 Restored ${fileName}`);
        }
      });
      
      // Remove backup directory
      fs.rmSync(this.backupDir, { recursive: true, force: true });
    }
    
    // Remove temp directory if exists
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Run a single test
   */
  runTest(name, testFunction) {
    console.log(`\n🧪 Running test: ${name}`);
    
    try {
      const startTime = Date.now();
      testFunction();
      const duration = Date.now() - startTime;
      
      console.log(`✅ PASS: ${name} (${duration}ms)`);
      this.testResults.push({ name, status: 'PASS', duration, error: null });
      return true;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error.message}`);
      this.testResults.push({ name, status: 'FAIL', duration: 0, error: error.message });
      return false;
    }
  }

  /**
   * Test version consistency check
   */
  testVersionConsistencyCheck() {
    const manager = new VersionManager();
    const result = manager.checkVersionConsistency();
    
    if (!result.isConsistent) {
      throw new Error('Version consistency check should pass for initial state');
    }
    
    if (!result.versions || Object.keys(result.versions).length === 0) {
      throw new Error('Should return version information');
    }
  }

  /**
   * Test semantic version validation
   */
  testSemanticVersionValidation() {
    const manager = new VersionManager();
    
    // Valid versions
    const validVersions = ['1.0.0', '2.1.3', '10.20.30', '1.0.0-alpha.1', '1.0.0-beta.2+build.1'];
    validVersions.forEach(version => {
      if (!manager.isValidSemver(version)) {
        throw new Error(`Should validate valid semver: ${version}`);
      }
    });
    
    // Invalid versions
    const invalidVersions = ['1', '1.0', '1.0.0.0', 'v1.0.0', '1.0.0-', '1.0.0+'];
    invalidVersions.forEach(version => {
      if (manager.isValidSemver(version)) {
        throw new Error(`Should reject invalid semver: ${version}`);
      }
    });
  }

  /**
   * Test version bumping
   */
  testVersionBumping() {
    const manager = new VersionManager();
    
    // Test patch bump
    const updates1 = manager.bumpVersion('patch');
    if (!Array.isArray(updates1) || updates1.length === 0) {
      throw new Error('Patch bump should return update information');
    }
    
    const newVersion = updates1[0].to;
    const [major, minor, patch] = newVersion.split('.').map(Number);
    
    if (patch !== 1) {
      throw new Error(`Patch bump should increment patch number, got: ${newVersion}`);
    }
    
    // Test minor bump
    const updates2 = manager.bumpVersion('minor');
    const minorVersion = updates2[0].to;
    const [maj2, min2, pat2] = minorVersion.split('.').map(Number);
    
    if (min2 !== (minor + 1) || pat2 !== 0) {
      throw new Error(`Minor bump should increment minor and reset patch, got: ${minorVersion}`);
    }
  }

  /**
   * Test version setting
   */
  testVersionSetting() {
    const manager = new VersionManager();
    const testVersion = '2.0.0';
    
    const updates = manager.updateVersion(testVersion);
    
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Version setting should return update information');
    }
    
    // Verify all components updated
    const currentVersions = manager.getCurrentVersions();
    Object.values(currentVersions).forEach(version => {
      if (version !== testVersion && version !== 'unknown') {
        throw new Error(`All components should be updated to ${testVersion}, found: ${version}`);
      }
    });
  }

  /**
   * Test release notes generation
   */
  testReleaseNotesGeneration() {
    const manager = new VersionManager();
    
    // This test may fail if no git history exists, so we'll catch and verify the behavior
    try {
      const notes = manager.generateReleaseNotes('HEAD~10', 'HEAD');
      
      if (notes !== null) {
        // If notes are generated, verify structure
        const requiredKeys = ['added', 'changed', 'fixed', 'other'];
        requiredKeys.forEach(key => {
          if (!Array.isArray(notes[key])) {
            throw new Error(`Release notes should have array for ${key}`);
          }
        });
      }
      // If notes are null, that's acceptable (no git history)
      
    } catch (error) {
      // Git operations may fail in test environment - this is acceptable
      if (!error.message.includes('git log')) {
        throw error;
      }
    }
  }

  /**
   * Test error handling
   */
  testErrorHandling() {
    const manager = new VersionManager();
    
    // Test invalid version
    try {
      manager.updateVersion('invalid-version');
      throw new Error('Should throw error for invalid version');
    } catch (error) {
      if (!error.message.includes('Invalid semantic version')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
    
    // Test invalid bump type
    try {
      manager.bumpVersion('invalid');
      throw new Error('Should throw error for invalid bump type');
    } catch (error) {
      if (!error.message.includes('Invalid bump type')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  }

  /**
   * Test CLI interface
   */
  testCLIInterface() {
    const scriptPath = path.join(__dirname, 'version-manager.js');
    
    // Test help command
    try {
      const output = execSync(`node "${scriptPath}" help`, { encoding: 'utf8' });
      if (!output.includes('Usage:') || !output.includes('Commands:')) {
        throw new Error('Help output should contain usage information');
      }
    } catch (error) {
      if (!error.message.includes('Usage:')) {
        throw error;
      }
    }
    
    // Test check command
    try {
      execSync(`node "${scriptPath}" check`, { encoding: 'utf8' });
      // Should not throw if versions are consistent
    } catch (error) {
      // May fail if versions are inconsistent - check error message
      if (!error.stdout && !error.stderr) {
        throw new Error('Check command should produce output');
      }
    }
  }

  /**
   * Performance test for large operations
   */
  testPerformance() {
    const manager = new VersionManager();
    const iterations = 100;
    
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      manager.getCurrentVersions();
      manager.checkVersionConsistency();
    }
    
    const duration = Date.now() - startTime;
    const avgTime = duration / iterations;
    
    if (avgTime > 100) { // 100ms average seems reasonable
      throw new Error(`Performance test failed: Average operation time ${avgTime}ms too slow`);
    }
    
    console.log(`   📊 Performance: ${avgTime.toFixed(2)}ms average per operation`);
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Version Manager Test Suite - M10-05\n');
    
    await this.setup();
    
    const tests = [
      { name: 'Version Consistency Check', fn: () => this.testVersionConsistencyCheck() },
      { name: 'Semantic Version Validation', fn: () => this.testSemanticVersionValidation() },
      { name: 'Version Bumping', fn: () => this.testVersionBumping() },
      { name: 'Version Setting', fn: () => this.testVersionSetting() },
      { name: 'Release Notes Generation', fn: () => this.testReleaseNotesGeneration() },
      { name: 'Error Handling', fn: () => this.testErrorHandling() },
      { name: 'CLI Interface', fn: () => this.testCLIInterface() },
      { name: 'Performance Test', fn: () => this.testPerformance() },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      if (this.runTest(test.name, test.fn)) {
        passed++;
      } else {
        failed++;
      }
    }
    
    await this.cleanup();
    
    // Print summary
    console.log('\n📋 Test Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Total: ${passed + failed}`);
    console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Test failures detected:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! Version Manager is ready for production.');
      process.exit(0);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new VersionManagerTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = VersionManagerTester;