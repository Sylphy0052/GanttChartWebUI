/**
 * AC2: Diff modal displays side-by-side comparison of conflicting changes with clear highlighting
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConflictError } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

interface ConflictData {
  field: string
  localValue: any
  remoteValue: any
  type: 'text' | 'date' | 'number' | 'object' | 'array'
  importance: 'critical' | 'high' | 'medium' | 'low'
}

interface ConflictDiffModalProps {
  isOpen: boolean
  onClose: () => void
  conflictError: ConflictError
  localData: any
  remoteData: any
  onResolve: (resolution: 'local' | 'remote' | 'manual', mergedData?: any) => void
  entityType: string
  entityId: string
}

export const ConflictDiffModal: React.FC<ConflictDiffModalProps> = ({
  isOpen,
  onClose,
  conflictError,
  localData,
  remoteData,
  onResolve,
  entityType,
  entityId
}) => {
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'manual'>('local')
  const [manualMerge, setManualMerge] = useState<any>(null)
  const [conflicts, setConflicts] = useState<ConflictData[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (isOpen) {
      detectConflicts()
    }
  }, [isOpen, localData, remoteData])

  const detectConflicts = () => {
    const detectedConflicts: ConflictData[] = []
    const conflictingFields = conflictError.conflictingFields || []

    // If specific fields are provided, use those
    if (conflictingFields.length > 0) {
      conflictingFields.forEach(field => {
        const localValue = getNestedValue(localData, field)
        const remoteValue = getNestedValue(remoteData, field)
        
        if (localValue !== remoteValue) {
          detectedConflicts.push({
            field,
            localValue,
            remoteValue,
            type: getValueType(localValue),
            importance: getFieldImportance(field)
          })
        }
      })
    } else {
      // Auto-detect conflicts by comparing all fields
      const allFields = new Set([
        ...Object.keys(localData || {}),
        ...Object.keys(remoteData || {})
      ])

      allFields.forEach(field => {
        const localValue = localData?.[field]
        const remoteValue = remoteData?.[field]
        
        if (localValue !== remoteValue) {
          detectedConflicts.push({
            field,
            localValue,
            remoteValue,
            type: getValueType(localValue),
            importance: getFieldImportance(field)
          })
        }
      })
    }

    setConflicts(detectedConflicts.sort((a, b) => {
      const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return importanceOrder[a.importance] - importanceOrder[b.importance]
    }))

    // Initialize manual merge with local data as base
    setManualMerge({ ...localData })
  }

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  const getValueType = (value: any): ConflictData['type'] => {
    if (value instanceof Date) return 'date'
    if (typeof value === 'number') return 'number'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object' && value !== null) return 'object'
    return 'text'
  }

  const getFieldImportance = (field: string): ConflictData['importance'] => {
    const criticalFields = ['id', 'version', 'status', 'title']
    const highFields = ['startDate', 'endDate', 'progress', 'assigneeId']
    const mediumFields = ['description', 'priority', 'estimatedHours']
    
    if (criticalFields.includes(field)) return 'critical'
    if (highFields.includes(field)) return 'high'
    if (mediumFields.includes(field)) return 'medium'
    return 'low'
  }

  const formatValue = (value: any, type: ConflictData['type']): string => {
    if (value === null || value === undefined) return '(empty)'
    
    switch (type) {
      case 'date':
        return new Date(value).toLocaleString()
      case 'object':
        return JSON.stringify(value, null, 2)
      case 'array':
        return JSON.stringify(value, null, 2)
      default:
        return String(value)
    }
  }

  const getConflictTypeColor = (type: ConflictError['conflictType']) => {
    switch (type) {
      case 'optimistic_lock': return 'bg-orange-100 text-orange-800'
      case 'resource_conflict': return 'bg-red-100 text-red-800'
      case 'dependency_conflict': return 'bg-purple-100 text-purple-800'
      case 'concurrent_modification': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getImportanceBadgeColor = (importance: ConflictData['importance']) => {
    switch (importance) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-white'
      case 'low': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const handleFieldValueSelect = (field: string, source: 'local' | 'remote') => {
    if (selectedResolution !== 'manual') {
      setSelectedResolution('manual')
    }

    const conflict = conflicts.find(c => c.field === field)
    if (conflict) {
      const value = source === 'local' ? conflict.localValue : conflict.remoteValue
      setManualMerge(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleResolve = () => {
    try {
      switch (selectedResolution) {
        case 'local':
          onResolve('local')
          toast.success('Resolved conflict using your local changes')
          break
        case 'remote':
          onResolve('remote')
          toast.success('Resolved conflict using remote changes')
          break
        case 'manual':
          onResolve('manual', manualMerge)
          toast.success('Resolved conflict using manual merge')
          break
      }
      onClose()
    } catch (error) {
      toast.error('Failed to resolve conflict')
    }
  }

  const criticalConflicts = conflicts.filter(c => c.importance === 'critical')
  const hasDataConflicts = conflicts.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Conflict Resolution Required</span>
            <Badge className={getConflictTypeColor(conflictError.conflictType)}>
              {conflictError.conflictType.replace('_', ' ')}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                Overview
                {criticalConflicts.length > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    {criticalConflicts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="comparison">
                Side-by-Side Comparison
              </TabsTrigger>
              <TabsTrigger value="resolution">
                Resolution Options
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Conflict Details</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p><strong>Entity:</strong> {entityType} ({entityId})</p>
                  <p><strong>Type:</strong> {conflictError.conflictType.replace('_', ' ')}</p>
                  <p><strong>Your Version:</strong> {conflictError.localVersion || 'Unknown'}</p>
                  <p><strong>Remote Version:</strong> {conflictError.remoteVersion || 'Unknown'}</p>
                  {conflictError.suggestedResolution && (
                    <p><strong>Suggestion:</strong> {conflictError.suggestedResolution}</p>
                  )}
                </div>
              </div>

              {hasDataConflicts && (
                <div className="space-y-3">
                  <h4 className="font-semibold">Conflicting Fields ({conflicts.length})</h4>
                  {conflicts.map((conflict, index) => (
                    <div 
                      key={conflict.field}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{conflict.field}</span>
                          <Badge 
                            className={getImportanceBadgeColor(conflict.importance)}
                            variant="secondary"
                          >
                            {conflict.importance}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {conflict.type}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="text-blue-600 font-medium">Your Value</div>
                          <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-400 font-mono text-xs">
                            {formatValue(conflict.localValue, conflict.type)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-green-600 font-medium">Remote Value</div>
                          <div className="bg-green-50 p-2 rounded border-l-4 border-green-400 font-mono text-xs">
                            {formatValue(conflict.remoteValue, conflict.type)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              <div className="grid grid-cols-2 gap-6 h-[400px]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <h4 className="font-semibold">Your Changes (Local)</h4>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 overflow-auto h-full">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(localData, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <h4 className="font-semibold">Remote Changes</h4>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 overflow-auto h-full">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(remoteData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {hasDataConflicts && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Field-by-Field Comparison</h4>
                  <div className="space-y-3 max-h-40 overflow-auto">
                    {conflicts.map((conflict) => (
                      <div key={conflict.field} className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium">{conflict.field}</div>
                        <div className="bg-blue-100 p-2 rounded text-xs font-mono">
                          {formatValue(conflict.localValue, conflict.type)}
                        </div>
                        <div className="bg-green-100 p-2 rounded text-xs font-mono">
                          {formatValue(conflict.remoteValue, conflict.type)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="resolution" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-semibold">Choose Resolution Strategy</h4>
                
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="resolution"
                      value="local"
                      checked={selectedResolution === 'local'}
                      onChange={(e) => setSelectedResolution(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Use Your Changes</div>
                      <div className="text-sm text-gray-600">
                        Keep all your local modifications and discard remote changes
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="resolution"
                      value="remote"
                      checked={selectedResolution === 'remote'}
                      onChange={(e) => setSelectedResolution(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Use Remote Changes</div>
                      <div className="text-sm text-gray-600">
                        Accept all remote modifications and discard your local changes
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="resolution"
                      value="manual"
                      checked={selectedResolution === 'manual'}
                      onChange={(e) => setSelectedResolution(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Manual Merge</div>
                      <div className="text-sm text-gray-600">
                        Choose specific values for each conflicting field
                      </div>
                    </div>
                  </label>
                </div>

                {selectedResolution === 'manual' && hasDataConflicts && (
                  <div className="border-t pt-4">
                    <h5 className="font-medium mb-3">Select Values for Each Field</h5>
                    <div className="space-y-3">
                      {conflicts.map((conflict) => (
                        <div key={conflict.field} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{conflict.field}</span>
                            <Badge 
                              className={getImportanceBadgeColor(conflict.importance)}
                              variant="secondary"
                            >
                              {conflict.importance}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant={manualMerge[conflict.field] === conflict.localValue ? 'default' : 'outline'}
                              size="sm"
                              className="h-auto p-2 text-left justify-start"
                              onClick={() => handleFieldValueSelect(conflict.field, 'local')}
                            >
                              <div>
                                <div className="text-blue-600 text-xs">Your Value</div>
                                <div className="font-mono text-xs">
                                  {formatValue(conflict.localValue, conflict.type).substring(0, 50)}
                                  {formatValue(conflict.localValue, conflict.type).length > 50 ? '...' : ''}
                                </div>
                              </div>
                            </Button>
                            <Button
                              variant={manualMerge[conflict.field] === conflict.remoteValue ? 'default' : 'outline'}
                              size="sm"
                              className="h-auto p-2 text-left justify-start"
                              onClick={() => handleFieldValueSelect(conflict.field, 'remote')}
                            >
                              <div>
                                <div className="text-green-600 text-xs">Remote Value</div>
                                <div className="font-mono text-xs">
                                  {formatValue(conflict.remoteValue, conflict.type).substring(0, 50)}
                                  {formatValue(conflict.remoteValue, conflict.type).length > 50 ? '...' : ''}
                                </div>
                              </div>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {conflicts.length > 0 ? (
              <>
                {conflicts.length} field{conflicts.length !== 1 ? 's' : ''} in conflict
                {criticalConflicts.length > 0 && (
                  <span className="text-red-600 font-medium">
                    {' '}({criticalConflicts.length} critical)
                  </span>
                )}
              </>
            ) : (
              'Version conflict detected - no data differences found'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleResolve}>
              Resolve Conflict
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}