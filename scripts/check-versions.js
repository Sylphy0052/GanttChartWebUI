#!/usr/bin/env node

/**
 * GanttChart WebUI Version Consistency Checker
 * 
 * このスクリプトは、Backend と Frontend の package.json バージョンの
 * 整合性をチェックし、一致しない場合はエラーを出力します。
 * 
 * Usage:
 *   node scripts/check-versions.js
 *   npm run version:check
 * 
 * Exit Codes:
 *   0 - バージョンが一致している
 *   1 - バージョンが一致していない、またはエラーが発生
 * 
 * @author GanttChart WebUI Team
 * @version 1.0.0
 * @since 2025-01-15
 */

const fs = require('fs');
const path = require('path');

// カラー定義
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// ログ関数
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`${colors.bold}${colors.cyan}${msg}${colors.reset}`)
};

/**
 * package.json ファイルを読み込む
 * @param {string} filePath - package.json のパス
 * @returns {Object} package.json の内容
 */
function readPackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * セマンティックバージョンの検証
 * @param {string} version - バージョン文字列
 * @returns {boolean} 有効な形式かどうか
 */
function isValidSemVer(version) {
  // SemVer 2.0.0 準拠の正規表現
  const semVerRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semVerRegex.test(version);
}

/**
 * バージョン情報を表示
 * @param {string} component - コンポーネント名
 * @param {string} version - バージョン
 * @param {boolean} isValid - バージョンが有効かどうか
 */
function displayVersion(component, version, isValid) {
  const status = isValid ? colors.green : colors.red;
  const icon = isValid ? '✓' : '✗';
  console.log(`  ${status}${icon}${colors.reset} ${colors.bold}${component}${colors.reset}: ${version}`);
  
  if (!isValid) {
    log.error(`    Invalid semantic version format: ${version}`);
  }
}

/**
 * 詳細なバージョン比較結果を表示
 * @param {string} backendVersion - Backend バージョン
 * @param {string} frontendVersion - Frontend バージョン
 */
function displayDetailedComparison(backendVersion, frontendVersion) {
  console.log('\n' + colors.cyan + '📊 Detailed Comparison:' + colors.reset);
  
  // バージョンを分解
  const parseVersion = (version) => {
    const [main, prerelease] = version.split('-');
    const [major, minor, patch] = main.split('.').map(Number);
    return { major, minor, patch, prerelease: prerelease || null };
  };
  
  try {
    const backend = parseVersion(backendVersion);
    const frontend = parseVersion(frontendVersion);
    
    console.log(`  Major Version: Backend=${backend.major}, Frontend=${frontend.major} ${backend.major === frontend.major ? '✓' : '✗'}`);
    console.log(`  Minor Version: Backend=${backend.minor}, Frontend=${frontend.minor} ${backend.minor === frontend.minor ? '✓' : '✗'}`);
    console.log(`  Patch Version: Backend=${backend.patch}, Frontend=${frontend.patch} ${backend.patch === frontend.patch ? '✓' : '✗'}`);
    
    if (backend.prerelease || frontend.prerelease) {
      const preMatch = backend.prerelease === frontend.prerelease;
      console.log(`  Prerelease: Backend=${backend.prerelease || 'none'}, Frontend=${frontend.prerelease || 'none'} ${preMatch ? '✓' : '✗'}`);
    }
  } catch (error) {
    log.warn('Could not parse versions for detailed comparison');
  }
}

/**
 * Git情報を表示
 */
function displayGitInfo() {
  try {
    const { execSync } = require('child_process');
    
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    
    console.log('\n' + colors.cyan + '🔧 Git Information:' + colors.reset);
    console.log(`  Branch: ${colors.bold}${branch}${colors.reset}`);
    console.log(`  Commit: ${colors.bold}${commit}${colors.reset}`);
    console.log(`  Status: ${status ? colors.yellow + 'Modified files detected' + colors.reset : colors.green + 'Clean working directory' + colors.reset}`);
    
    if (status) {
      log.warn('There are uncommitted changes in the working directory');
    }
  } catch (error) {
    log.warn('Could not retrieve Git information');
  }
}

/**
 * 推奨アクションを表示
 * @param {boolean} versionsMatch - バージョンが一致しているか
 * @param {boolean} backendValid - Backend バージョンが有効か
 * @param {boolean} frontendValid - Frontend バージョンが有効か
 */
function displayRecommendations(versionsMatch, backendValid, frontendValid) {
  console.log('\n' + colors.cyan + '💡 Recommendations:' + colors.reset);
  
  if (!versionsMatch) {
    console.log(`  ${colors.yellow}1.${colors.reset} Synchronize versions using: ${colors.bold}npm run version:sync${colors.reset}`);
    console.log(`  ${colors.yellow}2.${colors.reset} Or manually update package.json files`);
    console.log(`  ${colors.yellow}3.${colors.reset} Use release script: ${colors.bold}./scripts/release.sh sync-versions${colors.reset}`);
  }
  
  if (!backendValid || !frontendValid) {
    console.log(`  ${colors.yellow}•${colors.reset} Fix invalid semantic versions`);
    console.log(`  ${colors.yellow}•${colors.reset} Follow SemVer format: MAJOR.MINOR.PATCH`);
    console.log(`  ${colors.yellow}•${colors.reset} See: https://semver.org/`);
  }
  
  if (versionsMatch && backendValid && frontendValid) {
    console.log(`  ${colors.green}•${colors.reset} Versions are synchronized and valid`);
    console.log(`  ${colors.green}•${colors.reset} Ready for development or release`);
  }
}

/**
 * メイン処理
 */
function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const backendPackagePath = path.join(projectRoot, 'backend', 'package.json');
  const frontendPackagePath = path.join(projectRoot, 'frontend', 'package.json');
  const rootPackagePath = path.join(projectRoot, 'package.json');
  
  log.title('🔍 GanttChart WebUI Version Consistency Check');
  console.log('');
  
  try {
    // Root package.json 確認
    let rootVersion = null;
    try {
      const rootPackage = readPackageJson(rootPackagePath);
      rootVersion = rootPackage.version;
      log.info(`Root package version: ${rootVersion}`);
    } catch (error) {
      log.warn('Root package.json not found or invalid');
    }
    
    // Backend package.json 読み込み
    const backendPackage = readPackageJson(backendPackagePath);
    const backendVersion = backendPackage.version;
    const backendValid = isValidSemVer(backendVersion);
    
    // Frontend package.json 読み込み
    const frontendPackage = readPackageJson(frontendPackagePath);
    const frontendVersion = frontendPackage.version;
    const frontendValid = isValidSemVer(frontendVersion);
    
    // バージョン表示
    console.log(colors.cyan + '📦 Component Versions:' + colors.reset);
    displayVersion('Backend ', backendVersion, backendValid);
    displayVersion('Frontend', frontendVersion, frontendValid);
    
    if (rootVersion) {
      displayVersion('Root    ', rootVersion, isValidSemVer(rootVersion));
    }
    
    // バージョン一致確認
    const versionsMatch = backendVersion === frontendVersion;
    const allValid = backendValid && frontendValid;
    
    console.log('\n' + colors.cyan + '🔍 Consistency Check:' + colors.reset);
    
    if (versionsMatch && allValid) {
      log.success(`All versions are synchronized: ${colors.bold}${backendVersion}${colors.reset}`);
    } else {
      if (!versionsMatch) {
        log.error(`Version mismatch detected!`);
        log.error(`  Backend:  ${backendVersion}`);
        log.error(`  Frontend: ${frontendVersion}`);
      }
      
      if (!allValid) {
        log.error('Invalid semantic version format detected!');
      }
    }
    
    // Root バージョンチェック
    if (rootVersion && (rootVersion !== backendVersion || rootVersion !== frontendVersion)) {
      log.warn('Root package.json version does not match component versions');
    }
    
    // 詳細比較表示
    if (!versionsMatch) {
      displayDetailedComparison(backendVersion, frontendVersion);
    }
    
    // Git 情報表示
    displayGitInfo();
    
    // 推奨アクション表示
    displayRecommendations(versionsMatch, backendValid, frontendValid);
    
    // 終了処理
    if (versionsMatch && allValid) {
      console.log('\n' + colors.green + '🎉 Version consistency check passed!' + colors.reset);
      process.exit(0);
    } else {
      console.log('\n' + colors.red + '❌ Version consistency check failed!' + colors.reset);
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Version check failed: ${error.message}`);
    console.log('\n' + colors.cyan + '🔧 Troubleshooting:' + colors.reset);
    console.log(`  • Ensure both backend/package.json and frontend/package.json exist`);
    console.log(`  • Check file permissions and accessibility`);
    console.log(`  • Verify JSON syntax in package.json files`);
    process.exit(1);
  }
}

// メイン処理実行
if (require.main === module) {
  main();
}