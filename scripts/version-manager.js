#!/usr/bin/env node
/**
 * Version Manager Script - M10-05 Version Management System
 * 
 * Unified version management across monorepo components
 * Supports semantic versioning and automated release workflows
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.components = [
      { name: 'backend', path: path.join(this.rootDir, 'backend', 'package.json') },
      { name: 'frontend', path: path.join(this.rootDir, 'frontend', 'package.json') },
      { name: 'root', path: path.join(this.rootDir, 'package.json') }
    ];
    
    // Filter out components that don't exist
    this.components = this.components.filter(comp => fs.existsSync(comp.path));
  }

  /**
   * Get current versions of all components
   */
  getCurrentVersions() {
    const versions = {};
    this.components.forEach(comp => {
      try {
        const packageJson = JSON.parse(fs.readFileSync(comp.path, 'utf8'));
        versions[comp.name] = packageJson.version;
      } catch (error) {
        console.warn(`Warning: Could not read version from ${comp.path}: ${error.message}`);
        versions[comp.name] = 'unknown';
      }
    });
    return versions;
  }

  /**
   * Check if all component versions are in sync
   */
  checkVersionConsistency() {
    const versions = this.getCurrentVersions();
    const versionValues = Object.values(versions).filter(v => v !== 'unknown');
    
    if (versionValues.length === 0) {
      console.error('❌ No valid versions found');
      return false;
    }

    const firstVersion = versionValues[0];
    const isConsistent = versionValues.every(version => version === firstVersion);
    
    if (isConsistent) {
      console.log(`✅ All components are at version: ${firstVersion}`);
    } else {
      console.error('❌ Version inconsistency detected:');
      Object.entries(versions).forEach(([comp, ver]) => {
        console.error(`  ${comp}: ${ver}`);
      });
    }
    
    return { isConsistent, versions };
  }

  /**
   * Update version in all components
   */
  updateVersion(newVersion, skipValidation = false) {
    if (!skipValidation && !this.isValidSemver(newVersion)) {
      throw new Error(`Invalid semantic version: ${newVersion}`);
    }

    const updates = [];
    
    this.components.forEach(comp => {
      try {
        const packageJson = JSON.parse(fs.readFileSync(comp.path, 'utf8'));
        const oldVersion = packageJson.version;
        packageJson.version = newVersion;
        
        fs.writeFileSync(comp.path, JSON.stringify(packageJson, null, 2) + '\n');
        updates.push({ component: comp.name, from: oldVersion, to: newVersion });
        console.log(`✅ Updated ${comp.name}: ${oldVersion} → ${newVersion}`);
      } catch (error) {
        console.error(`❌ Failed to update ${comp.path}: ${error.message}`);
        throw error;
      }
    });

    return updates;
  }

  /**
   * Validate semantic versioning format
   */
  isValidSemver(version) {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[0-9a-zA-Z-]*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[0-9a-zA-Z-]*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  /**
   * Bump version according to semantic versioning
   */
  bumpVersion(type = 'patch') {
    const currentVersions = this.getCurrentVersions();
    const baseVersion = Object.values(currentVersions).find(v => v !== 'unknown');
    
    if (!baseVersion) {
      throw new Error('No valid base version found');
    }

    const [major, minor, patch] = baseVersion.split('.').map(Number);
    let newVersion;

    switch (type.toLowerCase()) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
      default:
        throw new Error(`Invalid bump type: ${type}. Use major, minor, or patch`);
    }

    return this.updateVersion(newVersion);
  }

  /**
   * Create git tag for release
   */
  createGitTag(version, message = null) {
    const tagName = `v${version}`;
    const tagMessage = message || `Release ${tagName}`;
    
    try {
      // Check if tag already exists
      try {
        execSync(`git rev-parse ${tagName}`, { stdio: 'pipe' });
        console.warn(`⚠️  Tag ${tagName} already exists`);
        return tagName;
      } catch {
        // Tag doesn't exist, continue
      }

      execSync(`git tag -a ${tagName} -m "${tagMessage}"`, { stdio: 'inherit' });
      console.log(`✅ Created git tag: ${tagName}`);
      return tagName;
    } catch (error) {
      throw new Error(`Failed to create git tag: ${error.message}`);
    }
  }

  /**
   * Full release process
   */
  release(type = 'patch', tagMessage = null, pushTag = false) {
    console.log(`🚀 Starting ${type} release process...`);
    
    // Check consistency first
    const consistencyCheck = this.checkVersionConsistency();
    if (!consistencyCheck.isConsistent) {
      throw new Error('Version inconsistency detected. Fix before release.');
    }

    // Bump version
    const updates = this.bumpVersion(type);
    const newVersion = updates[0]?.to;
    
    if (!newVersion) {
      throw new Error('Failed to determine new version');
    }

    // Create git tag
    const tagName = this.createGitTag(newVersion, tagMessage);

    // Push tag if requested
    if (pushTag) {
      try {
        execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
        console.log(`✅ Pushed tag ${tagName} to origin`);
      } catch (error) {
        console.warn(`⚠️  Failed to push tag: ${error.message}`);
      }
    }

    console.log(`🎉 Release ${newVersion} completed successfully!`);
    
    return {
      version: newVersion,
      tag: tagName,
      updates
    };
  }

  /**
   * Generate release notes from git commits
   */
  generateReleaseNotes(fromTag = null, toTag = 'HEAD') {
    try {
      const range = fromTag ? `${fromTag}..${toTag}` : toTag;
      const commits = execSync(`git log ${range} --oneline --no-merges`, { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());

      const releaseNotes = {
        added: [],
        changed: [],
        fixed: [],
        other: []
      };

      commits.forEach(commit => {
        const lower = commit.toLowerCase();
        if (lower.includes('feat:') || lower.includes('[feat]')) {
          releaseNotes.added.push(commit);
        } else if (lower.includes('fix:') || lower.includes('[fix]')) {
          releaseNotes.fixed.push(commit);
        } else if (lower.includes('refactor:') || lower.includes('[refactor]')) {
          releaseNotes.changed.push(commit);
        } else {
          releaseNotes.other.push(commit);
        }
      });

      return releaseNotes;
    } catch (error) {
      console.warn(`Warning: Could not generate release notes: ${error.message}`);
      return null;
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new VersionManager();

  try {
    switch (command) {
      case 'check':
        manager.checkVersionConsistency();
        break;

      case 'bump':
        const bumpType = args[1] || 'patch';
        manager.bumpVersion(bumpType);
        break;

      case 'set':
        const version = args[1];
        if (!version) {
          console.error('❌ Version required. Usage: npm run version:set 1.2.3');
          process.exit(1);
        }
        manager.updateVersion(version);
        break;

      case 'tag':
        const tagVersion = args[1];
        const tagMessage = args[2];
        if (!tagVersion) {
          const versions = manager.getCurrentVersions();
          const currentVersion = Object.values(versions)[0];
          if (currentVersion && currentVersion !== 'unknown') {
            manager.createGitTag(currentVersion, tagMessage);
          } else {
            console.error('❌ No valid version found for tagging');
            process.exit(1);
          }
        } else {
          manager.createGitTag(tagVersion, tagMessage);
        }
        break;

      case 'release':
        const releaseType = args[1] || 'patch';
        const releaseMessage = args[2];
        const shouldPush = args.includes('--push');
        manager.release(releaseType, releaseMessage, shouldPush);
        break;

      case 'notes':
        const fromTag = args[1];
        const toTag = args[2] || 'HEAD';
        const notes = manager.generateReleaseNotes(fromTag, toTag);
        if (notes) {
          console.log('\n📝 Release Notes:');
          if (notes.added.length > 0) {
            console.log('\n### Added');
            notes.added.forEach(item => console.log(`- ${item}`));
          }
          if (notes.changed.length > 0) {
            console.log('\n### Changed');
            notes.changed.forEach(item => console.log(`- ${item}`));
          }
          if (notes.fixed.length > 0) {
            console.log('\n### Fixed');
            notes.fixed.forEach(item => console.log(`- ${item}`));
          }
          if (notes.other.length > 0) {
            console.log('\n### Other');
            notes.other.forEach(item => console.log(`- ${item}`));
          }
        }
        break;

      case 'help':
      default:
        console.log(`
🔧 Version Manager - M10-05 Unified Version Management System

Usage:
  node scripts/version-manager.js <command> [options]

Commands:
  check                     Check version consistency across components
  bump [patch|minor|major]  Bump version (default: patch)
  set <version>             Set specific version (e.g., 1.2.3)
  tag [version] [message]   Create git tag (uses current version if not specified)
  release [type] [msg] [--push]  Full release process (bump + tag)
  notes [from-tag] [to-tag] Generate release notes from git commits
  help                      Show this help

Examples:
  node scripts/version-manager.js check
  node scripts/version-manager.js bump minor
  node scripts/version-manager.js set 1.2.0
  node scripts/version-manager.js release patch "Bug fixes" --push
  node scripts/version-manager.js notes v1.0.0 v1.1.0
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = VersionManager;