import { memo, useState, useCallback, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { ClockCircleOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import styles from './timeEdge.module.scss'

interface TimeEdgeData extends Record<string, unknown> {
  time?: string
  label?: string
  onTimeChange?: (newTime: string) => void
}

function TimeEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as TimeEdgeData
  const { time: initialTime = '', label = '', onTimeChange } = edgeData
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const [isEditingTime, setIsEditingTime] = useState(false)
  const [editedTime, setEditedTime] = useState(initialTime || label || '')

  // Update editedTime when data.time changes externally
  useEffect(() => {
    const currentTime = (edgeData as any)?.time || (edgeData as any)?.label || ''
    setEditedTime(currentTime)
  }, [edgeData])

  const handleTimeDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTime(true)
  }, [])

  const handleTimeBlur = useCallback(() => {
    setIsEditingTime(false)
    if (onTimeChange && editedTime !== initialTime) {
      onTimeChange(editedTime)
    }
  }, [editedTime, initialTime, onTimeChange])

  const handleTimeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTimeBlur()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditedTime(initialTime || label || '')
      setIsEditingTime(false)
    }
  }, [handleTimeBlur, initialTime, label])

  const displayTime = (edgeData as any)?.time || (edgeData as any)?.label || ''

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: '#8c8c8c',
          strokeWidth: 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={styles.edgeLabel}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {isEditingTime ? (
            <Input
              value={editedTime}
              onChange={(e) => setEditedTime(e.target.value)}
              onBlur={handleTimeBlur}
              onKeyDown={handleTimeKeyDown}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              autoFocus
              className={styles.timeInput}
              size="small"
              style={{ minWidth: '80px', textAlign: 'center' }}
            />
          ) : (
            <div
              className={styles.timeBadge}
              onDoubleClick={handleTimeDoubleClick}
              title="Double click to edit"
            >
              {displayTime && (
                <>
                  <ClockCircleOutlined className={styles.timeIcon} />
                  <span className={styles.timeText}>{displayTime}</span>
                </>
              )}
              {!displayTime && (
                <span className={styles.timePlaceholder}>Double click to add time</span>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const TimeEdge = memo(TimeEdgeComponent)

