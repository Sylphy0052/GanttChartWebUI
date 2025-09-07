#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * This script analyzes the Next.js build output and generates a comprehensive
 * bundle size report for T037: Frontend Bundle Size Optimization
 */

const fs = require('fs')
const path = require('path')

// Calculate file size in KB
function getFileSizeInKB(filePath) {
  try {
    const stats = fs.statSync(filePath)
    return Math.round(stats.size / 1024 * 100) / 100
  } catch {
    return 0
  }
}

// Get all files in directory with specific extensions
function getFilesWithExtensions(dir, extensions) {
  const files = []
  
  function traverse(currentDir) {
    if (!fs.existsSync(currentDir)) return
    
    const items = fs.readdirSync(currentDir)
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        traverse(fullPath)
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push({
          name: path.relative(dir, fullPath),
          path: fullPath,
          size: getFileSizeInKB(fullPath)
        })
      }
    }
  }
  
  traverse(dir)
  return files
}

// Analyze the Next.js build
function analyzeBuild() {
  const buildDir = path.join(process.cwd(), '.next')
  const staticDir = path.join(buildDir, 'static')
  
  console.log('🔍 Analyzing Next.js Bundle...')
  console.log('=====================================\n')
  
  // Get JavaScript chunks
  const jsChunks = getFilesWithExtensions(path.join(staticDir, 'chunks'), ['.js'])
  const jsTotal = jsChunks.reduce((total, chunk) => total + chunk.size, 0)
  
  // Get CSS files
  const cssFiles = getFilesWithExtensions(path.join(staticDir, 'css'), ['.css'])
  const cssTotal = cssFiles.reduce((total, file) => total + file.size, 0)
  
  // Sort chunks by size
  jsChunks.sort((a, b) => b.size - a.size)
  cssFiles.sort((a, b) => b.size - a.size)
  
  // Find initial bundle (usually the largest page chunks)
  const initialChunks = jsChunks.filter(chunk => 
    chunk.name.includes('main-') || 
    chunk.name.includes('framework-') ||
    chunk.name.includes('polyfills-')
  )
  const initialJS = initialChunks.reduce((total, chunk) => total + chunk.size, 0)
  
  // Calculate totals
  const analysis = {
    timestamp: new Date().toISOString(),
    javascript: {
      initial: initialJS,
      total: jsTotal,
      chunks: jsChunks.slice(0, 10) // Top 10
    },
    css: {
      total: cssTotal,
      files: cssFiles
    }
  }
  
  // Generate report
  console.log('📊 Bundle Size Summary')
  console.log('----------------------')
  console.log(`Initial JavaScript: ${analysis.javascript.initial.toFixed(2)} KB`)
  console.log(`Total JavaScript: ${analysis.javascript.total.toFixed(2)} KB`)
  console.log(`Total CSS: ${analysis.css.total.toFixed(2)} KB`)
  console.log(`Combined Total: ${(analysis.javascript.total + analysis.css.total).toFixed(2)} KB`)
  
  console.log('\n🗂️  Top JavaScript Chunks')
  console.log('---------------------------')
  analysis.javascript.chunks.forEach((chunk, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${chunk.name.padEnd(35)} ${chunk.size.toFixed(2).padStart(8)} KB`)
  })
  
  if (analysis.css.files.length > 0) {
    console.log('\n🎨 CSS Files')
    console.log('-------------')
    analysis.css.files.forEach((file, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${file.name.padEnd(35)} ${file.size.toFixed(2).padStart(8)} KB`)
    })
  }
  
  // Bundle health check
  console.log('\n🏥 Bundle Health Check')
  console.log('----------------------')
  
  const checks = [
    {
      name: 'Initial JS Bundle Size',
      value: analysis.javascript.initial,
      threshold: 150,
      unit: 'KB'
    },
    {
      name: 'Total JS Bundle Size',
      value: analysis.javascript.total,
      threshold: 500,
      unit: 'KB'
    },
    {
      name: 'CSS Bundle Size',
      value: analysis.css.total,
      threshold: 50,
      unit: 'KB'
    }
  ]
  
  checks.forEach(check => {
    const status = check.value <= check.threshold ? '✅' : '❌'
    const percentage = ((check.value / check.threshold) * 100).toFixed(1)
    console.log(`${status} ${check.name}: ${check.value.toFixed(2)} ${check.unit} (${percentage}% of threshold)`)
  })
  
  // Optimization recommendations
  console.log('\n💡 Optimization Recommendations')
  console.log('--------------------------------')
  
  if (analysis.javascript.initial > 150) {
    console.log('• Consider implementing code splitting for large components')
  }
  
  const largeChunks = analysis.javascript.chunks.filter(chunk => chunk.size > 100)
  if (largeChunks.length > 0) {
    console.log('• Large chunks detected - consider further splitting:')
    largeChunks.forEach(chunk => {
      console.log(`  - ${chunk.name} (${chunk.size.toFixed(2)} KB)`)
    })
  }
  
  if (analysis.javascript.total > 400) {
    console.log('• Total bundle size is large - consider tree shaking unused code')
  }
  
  // Save analysis to file
  const reportPath = path.join(process.cwd(), 'bundle-analysis.json')
  fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2))
  console.log(`\n📄 Detailed analysis saved to: ${reportPath}`)
  
  return analysis
}

// Main execution
if (require.main === module) {
  try {
    analyzeBuild()
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message)
    process.exit(1)
  }
}

module.exports = { analyzeBuild }