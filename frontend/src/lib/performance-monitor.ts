/**
 * パフォーマンスメトリクス計測基盤
 * KPI目標値: initial_render_ms_p95 (1500ms), drag_latency_ms_p95 (100ms)
 */

export interface PerformanceMetrics {
  /** 初期レンダリング時間 (ms) */
  initial_render_ms: number
  /** ドラッグ操作のレイテンシ (ms) */
  drag_latency_ms: number
  /** ページ読み込み時間 (ms) */
  page_load_ms: number
  /** DOM構築時間 (ms) */
  dom_content_loaded_ms: number
  /** Web Vitals メトリクス */
  web_vitals: WebVitalsMetrics
  /** 計測タイムスタンプ */
  timestamp: number
  /** 計測対象のページやコンポーネント */
  target: string
  /** ユーザーエージェント情報 */
  user_agent: string
}

export interface WebVitalsMetrics {
  /** Largest Contentful Paint (ms) */
  lcp: number | null
  /** First Input Delay (ms) */
  fid: number | null
  /** Cumulative Layout Shift */
  cls: number | null
  /** Time to First Byte (ms) */
  ttfb: number | null
}

export interface PerformanceThresholds {
  /** 初期レンダリング時間の95パーセンタイル閾値 */
  initial_render_ms_p95: number
  /** ドラッグレイテンシの95パーセンタイル閾値 */
  drag_latency_ms_p95: number
  /** Web Vitals 閾値 */
  web_vitals_thresholds: {
    lcp_good: number
    fid_good: number
    cls_good: number
    ttfb_good: number
  }
}

export interface PerformanceReport {
  /** 計測データ */
  metrics: PerformanceMetrics[]
  /** 統計情報 */
  statistics: PerformanceStatistics
  /** 閾値評価結果 */
  evaluation: PerformanceEvaluation
  /** 生成時刻 */
  generated_at: string
}

export interface PerformanceStatistics {
  initial_render_ms: StatisticsData
  drag_latency_ms: StatisticsData
  page_load_ms: StatisticsData
}

export interface StatisticsData {
  count: number
  min: number
  max: number
  mean: number
  median: number
  p95: number
  std_dev: number
}

export interface PerformanceEvaluation {
  initial_render_ms_p95_pass: boolean
  drag_latency_ms_p95_pass: boolean
  web_vitals_pass: boolean
  overall_score: number
  recommendations: string[]
}

export interface LayoutShiftEntry extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

export interface FirstInputEntry extends PerformanceEntry {
  processingStart: number
}

/**
 * パフォーマンス監視クラス
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private thresholds: PerformanceThresholds
  private performanceObserver: PerformanceObserver | null = null
  private dragStartTime: number = 0
  private renderStartTime: number = 0

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      initial_render_ms_p95: 1500, // KPI目標値
      drag_latency_ms_p95: 100,   // KPI目標値
      web_vitals_thresholds: {
        lcp_good: 2500,
        fid_good: 100,
        cls_good: 0.1,
        ttfb_good: 800
      },
      ...thresholds
    }

    this.initializePerformanceObserver()
    this.initializeWebVitalsMonitoring()
  }

  /**
   * Performance Observer の初期化
   */
  private initializePerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.handleNavigationTiming(entry as PerformanceNavigationTiming)
          } else if (entry.entryType === 'measure') {
            this.handleUserTiming(entry)
          }
        })
      })

      this.performanceObserver.observe({
        entryTypes: ['navigation', 'measure', 'paint']
      })
    } catch (error) {
      console.warn('Performance Observer initialization failed:', error)
    }
  }

  /**
   * Web Vitals 監視の初期化
   */
  private initializeWebVitalsMonitoring(): void {
    if (typeof window === 'undefined') return

    // LCP (Largest Contentful Paint)
    this.observeLCP()

    // FID (First Input Delay)
    this.observeFID()

    // CLS (Cumulative Layout Shift)
    this.observeCLS()

    // TTFB (Time to First Byte)
    this.observeTTFB()
  }

  /**
   * 初期レンダリング計測開始
   */
  startRenderMeasure(target: string): void {
    this.renderStartTime = performance.now()
    performance.mark(`render-start-${target}`)
  }

  /**
   * 初期レンダリング計測終了
   */
  endRenderMeasure(target: string): PerformanceMetrics {
    const endTime = performance.now()
    const renderTime = endTime - this.renderStartTime
    
    performance.mark(`render-end-${target}`)
    performance.measure(
      `render-duration-${target}`,
      `render-start-${target}`,
      `render-end-${target}`
    )

    const metrics: PerformanceMetrics = {
      initial_render_ms: renderTime,
      drag_latency_ms: 0,
      page_load_ms: this.getPageLoadTime(),
      dom_content_loaded_ms: this.getDOMContentLoadedTime(),
      web_vitals: this.getCurrentWebVitals(),
      timestamp: Date.now(),
      target: target,
      user_agent: navigator.userAgent
    }

    this.metrics.push(metrics)
    return metrics
  }

  /**
   * ドラッグ操作計測開始
   */
  startDragMeasure(target: string): void {
    this.dragStartTime = performance.now()
    performance.mark(`drag-start-${target}`)
  }

  /**
   * ドラッグ操作計測終了
   */
  endDragMeasure(target: string): PerformanceMetrics {
    const endTime = performance.now()
    const dragLatency = endTime - this.dragStartTime
    
    performance.mark(`drag-end-${target}`)
    performance.measure(
      `drag-duration-${target}`,
      `drag-start-${target}`,
      `drag-end-${target}`
    )

    const metrics: PerformanceMetrics = {
      initial_render_ms: 0,
      drag_latency_ms: dragLatency,
      page_load_ms: this.getPageLoadTime(),
      dom_content_loaded_ms: this.getDOMContentLoadedTime(),
      web_vitals: this.getCurrentWebVitals(),
      timestamp: Date.now(),
      target: target,
      user_agent: navigator.userAgent
    }

    this.metrics.push(metrics)
    return metrics
  }

  /**
   * Navigation Timing 処理
   */
  private handleNavigationTiming(entry: PerformanceNavigationTiming): void {
    const metrics: PerformanceMetrics = {
      initial_render_ms: entry.loadEventEnd - entry.loadEventStart,
      drag_latency_ms: 0,
      page_load_ms: entry.loadEventEnd - entry.navigationStart,
      dom_content_loaded_ms: entry.domContentLoadedEventEnd - entry.navigationStart,
      web_vitals: this.getCurrentWebVitals(),
      timestamp: Date.now(),
      target: 'navigation',
      user_agent: navigator.userAgent
    }

    this.metrics.push(metrics)
  }

  /**
   * User Timing 処理
   */
  private handleUserTiming(entry: PerformanceEntry): void {
    console.log(`Performance measure: ${entry.name} = ${entry.duration}ms`)
  }

  /**
   * LCP (Largest Contentful Paint) 監視
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) {
          this.updateWebVitals('lcp', lastEntry.startTime)
        }
      })
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
    } catch (error) {
      console.warn('LCP observation failed:', error)
    }
  }

  /**
   * FID (First Input Delay) 監視
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const fidEntry = entry as FirstInputEntry
          if (fidEntry.processingStart && fidEntry.startTime) {
            const fid = fidEntry.processingStart - fidEntry.startTime
            this.updateWebVitals('fid', fid)
          }
        })
      })
      observer.observe({ entryTypes: ['first-input'] })
    } catch (error) {
      console.warn('FID observation failed:', error)
    }
  }

  /**
   * CLS (Cumulative Layout Shift) 監視
   */
  private observeCLS(): void {
    try {
      let clsValue = 0
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const clsEntry = entry as LayoutShiftEntry
          if (!clsEntry.hadRecentInput) {
            clsValue += clsEntry.value
          }
        })
        this.updateWebVitals('cls', clsValue)
      })
      observer.observe({ entryTypes: ['layout-shift'] })
    } catch (error) {
      console.warn('CLS observation failed:', error)
    }
  }

  /**
   * TTFB (Time to First Byte) 監視
   */
  private observeTTFB(): void {
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart - navigationEntry.requestStart
        this.updateWebVitals('ttfb', ttfb)
      }
    } catch (error) {
      console.warn('TTFB observation failed:', error)
    }
  }

  private currentWebVitals: WebVitalsMetrics = {
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null
  }

  private updateWebVitals(metric: keyof WebVitalsMetrics, value: number): void {
    this.currentWebVitals[metric] = value
  }

  private getCurrentWebVitals(): WebVitalsMetrics {
    return { ...this.currentWebVitals }
  }

  private getPageLoadTime(): number {
    if (typeof window === 'undefined' || !performance.timing) return 0
    return performance.timing.loadEventEnd - performance.timing.navigationStart
  }

  private getDOMContentLoadedTime(): number {
    if (typeof window === 'undefined' || !performance.timing) return 0
    return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
  }

  /**
   * 統計計算
   */
  private calculateStatistics(values: number[]): StatisticsData {
    if (values.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        std_dev: 0
      }
    }

    const sorted = values.slice().sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((acc, val) => acc + val, 0)
    const mean = sum / count

    // 標準偏差計算
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count
    const std_dev = Math.sqrt(variance)

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      std_dev
    }
  }

  /**
   * パフォーマンスレポート生成
   */
  generateReport(): PerformanceReport {
    const initialRenderTimes = this.metrics
      .filter(m => m.initial_render_ms > 0)
      .map(m => m.initial_render_ms)
    
    const dragLatencies = this.metrics
      .filter(m => m.drag_latency_ms > 0)
      .map(m => m.drag_latency_ms)
    
    const pageLoadTimes = this.metrics.map(m => m.page_load_ms)

    const statistics: PerformanceStatistics = {
      initial_render_ms: this.calculateStatistics(initialRenderTimes),
      drag_latency_ms: this.calculateStatistics(dragLatencies),
      page_load_ms: this.calculateStatistics(pageLoadTimes)
    }

    const evaluation = this.evaluatePerformance(statistics)

    return {
      metrics: this.metrics,
      statistics,
      evaluation,
      generated_at: new Date().toISOString()
    }
  }

  /**
   * パフォーマンス評価
   */
  private evaluatePerformance(statistics: PerformanceStatistics): PerformanceEvaluation {
    const initialRenderPass = statistics.initial_render_ms.p95 <= this.thresholds.initial_render_ms_p95
    const dragLatencyPass = statistics.drag_latency_ms.p95 <= this.thresholds.drag_latency_ms_p95
    
    // Web Vitals評価
    const webVitalsPass = this.currentWebVitals.lcp !== null &&
                         this.currentWebVitals.lcp <= this.thresholds.web_vitals_thresholds.lcp_good

    let score = 0
    if (initialRenderPass) score += 40
    if (dragLatencyPass) score += 40
    if (webVitalsPass) score += 20

    const recommendations: string[] = []
    if (!initialRenderPass) {
      recommendations.push(`初期レンダリング時間を改善してください (現在: ${statistics.initial_render_ms.p95}ms, 目標: ${this.thresholds.initial_render_ms_p95}ms)`)
    }
    if (!dragLatencyPass) {
      recommendations.push(`ドラッグ操作のレスポンス時間を改善してください (現在: ${statistics.drag_latency_ms.p95}ms, 目標: ${this.thresholds.drag_latency_ms_p95}ms)`)
    }
    if (!webVitalsPass) {
      recommendations.push('Web Vitalsメトリクスを改善してください')
    }

    return {
      initial_render_ms_p95_pass: initialRenderPass,
      drag_latency_ms_p95_pass: dragLatencyPass,
      web_vitals_pass: webVitalsPass,
      overall_score: score,
      recommendations
    }
  }

  /**
   * メトリクス取得
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  /**
   * メトリクスクリア
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * CSV形式でエクスポート
   */
  exportToCSV(): string {
    const headers = [
      'timestamp',
      'target',
      'initial_render_ms',
      'drag_latency_ms',
      'page_load_ms',
      'dom_content_loaded_ms',
      'lcp',
      'fid',
      'cls',
      'ttfb',
      'user_agent'
    ]

    const rows = this.metrics.map(metric => [
      new Date(metric.timestamp).toISOString(),
      metric.target,
      metric.initial_render_ms,
      metric.drag_latency_ms,
      metric.page_load_ms,
      metric.dom_content_loaded_ms,
      metric.web_vitals.lcp || '',
      metric.web_vitals.fid || '',
      metric.web_vitals.cls || '',
      metric.web_vitals.ttfb || '',
      metric.user_agent
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  /**
   * ローカルストレージに保存
   */
  saveToLocalStorage(key: string = 'performance-metrics'): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(this.metrics))
    }
  }

  /**
   * ローカルストレージから読み込み
   */
  loadFromLocalStorage(key: string = 'performance-metrics'): void {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(key)
      if (data) {
        try {
          this.metrics = JSON.parse(data)
        } catch (error) {
          console.warn('Failed to load metrics from localStorage:', error)
        }
      }
    }
  }

  /**
   * リソース解放
   */
  dispose(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }
  }
}

/**
 * グローバルパフォーマンス監視インスタンス
 */
export const globalPerformanceMonitor = new PerformanceMonitor()

/**
 * React Hook: パフォーマンス監視
 */
export function usePerformanceMonitoring() {
  const monitor = globalPerformanceMonitor

  const startRender = (target: string) => monitor.startRenderMeasure(target)
  const endRender = (target: string) => monitor.endRenderMeasure(target)
  const startDrag = (target: string) => monitor.startDragMeasure(target)
  const endDrag = (target: string) => monitor.endDragMeasure(target)
  const getReport = () => monitor.generateReport()

  return {
    startRender,
    endRender,
    startDrag,
    endDrag,
    getReport,
    monitor
  }
}