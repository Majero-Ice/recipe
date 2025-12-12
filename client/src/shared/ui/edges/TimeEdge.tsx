import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { ClockCircleOutlined } from '@ant-design/icons'
import styles from './timeEdge.module.scss'

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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const time = (data as any)?.time || (data as any)?.label || ''

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
      {time && (
        <EdgeLabelRenderer>
          <div
            className={styles.edgeLabel}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <div className={styles.timeBadge}>
              <ClockCircleOutlined className={styles.timeIcon} />
              <span className={styles.timeText}>{time}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const TimeEdge = memo(TimeEdgeComponent)

