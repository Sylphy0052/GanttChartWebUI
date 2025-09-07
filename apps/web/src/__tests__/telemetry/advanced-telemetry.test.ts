/**
 * Advanced Telemetry System Tests
 * 
 * Tests for T016: Advanced KPI Measurement & Telemetry
 * 
 * Validates:
 * - Component-level performance tracking
 * - Memory leak detection
 * - User interaction tracking
 * - KPI measurement accuracy
 * - Telemetry data collection and batching
 */

import { AdvancedTelemetrySystem, ComponentPerformanceMetrics } from '@/lib/advanced-telemetry'

// Mock browser APIs
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 1024 * 1024 * 1024 // 1GB
  }
}

const mockDocument = {
  querySelectorAll: jest.fn(() => ({ length: 100 }))
}

// Mock window and global objects
Object.defineProperty(window, 'performance', {
  value: mockPerformance,
  writable: true
})

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
})

Object.defineProperty(window, 'PerformanceObserver', {
  value: class MockPerformanceObserver {
    constructor(callback: any) {}
    observe() {}
    disconnect() {}
  },
  writable: true
})

Object.defineProperty(window, 'IntersectionObserver', {
  value: class MockIntersectionObserver {
    constructor(callback: any) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  writable: true
})

describe('AdvancedTelemetrySystem', () => {
  let telemetrySystem: AdvancedTelemetrySystem
  
  beforeEach(() => {
    telemetrySystem = new AdvancedTelemetrySystem()
    jest.clearAllMocks()
  })

  afterEach(() => {
    telemetrySystem.stopCapturing()
  })

  describe('Component Performance Tracking', () => {
    it('should start component tracking', () => {
      const componentName = 'TestComponent'
      const componentId = 'test-123'
      
      telemetrySystem.startComponentTracking(componentName, componentId)
      
      const metrics = telemetrySystem.getComponentMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].componentName).toBe(componentName)
      expect(metrics[0].componentId).toBe(componentId)
    })

    it('should record component render time', () => {
      const componentId = 'test-123'
      const renderDuration = 50
      
      telemetrySystem.startComponentTracking('TestComponent', componentId)
      telemetrySystem.recordComponentRender(componentId, renderDuration)
      
      const metrics = telemetrySystem.getComponentMetrics()
      expect(metrics[0].renderTime).toBe(renderDuration)
      expect(metrics[0].rerenderCount).toBe(1)
    })

    it('should record component updates', () => {
      const componentId = 'test-123'
      const updateDuration = 25
      
      telemetrySystem.startComponentTracking('TestComponent', componentId)
      telemetrySystem.recordComponentUpdate(componentId, 'props', updateDuration)
      
      const metrics = telemetrySystem.getComponentMetrics()
      expect(metrics[0].updateTime).toBe(updateDuration)
      expect(metrics[0].propsUpdateCount).toBe(1)
      expect(metrics[0].stateUpdateCount).toBe(0)
    })

    it('should stop component tracking', () => {
      const componentId = 'test-123'
      
      telemetrySystem.startComponentTracking('TestComponent', componentId)
      const metricsBeforeStop = telemetrySystem.getComponentMetrics()
      expect(metricsBeforeStop[0].unmountTime).toBeUndefined()
      
      telemetrySystem.stopComponentTracking(componentId)
      
      const metricsAfterStop = telemetrySystem.getComponentMetrics()
      expect(metricsAfterStop[0].unmountTime).toBeDefined()
    })
  })

  describe('Advanced KPI Collection', () => {
    it('should collect comprehensive KPI metrics', () => {
      const kpis = telemetrySystem.collectAdvancedKPIs()
      
      expect(kpis).toHaveProperty('performance')
      expect(kpis).toHaveProperty('memory')
      expect(kpis).toHaveProperty('interaction')
      expect(kpis).toHaveProperty('business')
      expect(kpis).toHaveProperty('system')
      expect(kpis).toHaveProperty('timestamp')
      expect(kpis).toHaveProperty('sessionId')
    })

    it('should calculate performance metrics correctly', () => {
      const kpis = telemetrySystem.collectAdvancedKPIs()
      
      expect(kpis.performance.framerate).toBeGreaterThanOrEqual(0)
      expect(kpis.performance.framerate).toBeLessThanOrEqual(60)
      expect(kpis.memory.heapUsed).toBeGreaterThan(0)
      expect(kpis.system.deviceInfo).toHaveProperty('type')
    })

    it('should track session information', () => {
      const kpis = telemetrySystem.collectAdvancedKPIs()
      
      expect(kpis.sessionId).toBeDefined()
      expect(kpis.sessionId).toMatch(/^telemetry-\d+-[a-z0-9]+$/)
      expect(kpis.timestamp).toBeCloseTo(Date.now(), -2) // Within 100ms
    })
  })

  describe('Memory Leak Detection', () => {
    it('should detect memory growth patterns', () => {
      // Mock increasing memory usage
      let memoryUsage = 50
      jest.spyOn(telemetrySystem as any, 'getCurrentMemoryUsage').mockImplementation(() => {
        memoryUsage += 10
        return memoryUsage
      })
      
      const kpis = telemetrySystem.collectAdvancedKPIs()
      expect(kpis.memory.heapUsed).toBeGreaterThan(50)
    })

    it('should provide memory leak recommendations', () => {
      const kpis = telemetrySystem.collectAdvancedKPIs()
      
      if (kpis.memory.memoryLeaks.length > 0) {
        expect(kpis.memory.memoryLeaks[0]).toHaveProperty('type')
        expect(kpis.memory.memoryLeaks[0]).toHaveProperty('recommendations')
        expect(kpis.memory.memoryLeaks[0].recommendations).toBeInstanceOf(Array)
      }
    })
  })

  describe('Telemetry Data Export', () => {
    it('should export comprehensive telemetry data', () => {
      const componentId = 'test-component'
      telemetrySystem.startComponentTracking('TestComponent', componentId)
      telemetrySystem.recordComponentRender(componentId, 100)
      
      const exportedData = telemetrySystem.exportData()
      
      expect(exportedData).toHaveProperty('sessionId')
      expect(exportedData).toHaveProperty('componentMetrics')
      expect(exportedData).toHaveProperty('kpiMetrics')
      expect(exportedData).toHaveProperty('memoryLeaks')
      
      expect(exportedData.componentMetrics).toHaveLength(1)
      expect(exportedData.componentMetrics[0].componentName).toBe('TestComponent')
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should integrate with existing performance monitor', () => {
      const kpis = telemetrySystem.collectAdvancedKPIs()
      
      // Should have basic performance data
      expect(kpis.performance).toBeDefined()
      expect(typeof kpis.performance.initialRenderTime).toBe('number')
      expect(typeof kpis.performance.framerate).toBe('number')
    })

    it('should provide system health information', () => {
      const kpis = telemetrySystem.collectAdvancedKPIs()
      
      expect(kpis.system.uptime).toBeGreaterThan(0)
      expect(kpis.system.browserInfo).toHaveProperty('userAgent')
      expect(kpis.system.deviceInfo).toHaveProperty('type')
      expect(['desktop', 'tablet', 'mobile']).toContain(kpis.system.deviceInfo.type)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle missing component gracefully', () => {
      const nonExistentId = 'non-existent-123'
      
      // Should not throw error
      expect(() => {
        telemetrySystem.recordComponentRender(nonExistentId, 100)
      }).not.toThrow()
      
      expect(() => {
        telemetrySystem.recordComponentUpdate(nonExistentId, 'props', 50)
      }).not.toThrow()
      
      expect(() => {
        telemetrySystem.stopComponentTracking(nonExistentId)
      }).not.toThrow()
    })

    it('should handle browser API unavailability', () => {
      // Mock unavailable performance.memory
      const originalMemory = (window.performance as any).memory
      delete (window.performance as any).memory
      
      const kpis = telemetrySystem.collectAdvancedKPIs()
      expect(kpis.memory.heapUsed).toBe(0) // Should fallback gracefully
      
      // Restore
      ;(window.performance as any).memory = originalMemory
    })
  })

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const system1 = new AdvancedTelemetrySystem()
      const system2 = new AdvancedTelemetrySystem()
      
      const kpis1 = system1.getAdvancedKPIs()
      const kpis2 = system2.getAdvancedKPIs()
      
      expect(kpis1.sessionId).not.toBe(kpis2.sessionId)
      
      system1.stopCapturing()
      system2.stopCapturing()
    })

    it('should maintain session consistency', () => {
      const kpis1 = telemetrySystem.getAdvancedKPIs()
      const kpis2 = telemetrySystem.getAdvancedKPIs()
      
      expect(kpis1.sessionId).toBe(kpis2.sessionId)
    })
  })
})

describe('Component Performance Metrics Interface', () => {
  it('should have correct structure for ComponentPerformanceMetrics', () => {
    const mockMetrics: ComponentPerformanceMetrics = {
      componentName: 'TestComponent',
      componentId: 'test-123',
      renderTime: 50,
      mountTime: 100,
      updateTime: 25,
      rerenderCount: 5,
      propsUpdateCount: 3,
      stateUpdateCount: 2,
      childrenCount: 10,
      memoryUsage: 15.5,
      domNodeCount: 50,
      eventListenerCount: 8,
      isVisible: true,
      timestamp: Date.now()
    }

    expect(mockMetrics).toHaveProperty('componentName')
    expect(mockMetrics).toHaveProperty('componentId')
    expect(mockMetrics).toHaveProperty('renderTime')
    expect(mockMetrics).toHaveProperty('memoryUsage')
    expect(typeof mockMetrics.renderTime).toBe('number')
    expect(typeof mockMetrics.memoryUsage).toBe('number')
    expect(typeof mockMetrics.isVisible).toBe('boolean')
  })
})