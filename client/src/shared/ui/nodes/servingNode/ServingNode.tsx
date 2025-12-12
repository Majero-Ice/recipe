import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import styles from './servingNode.module.scss'

const { Text } = Typography

interface ServingNodeData extends Record<string, unknown> {
  label?: string
  description?: string
  icon?: React.ReactNode
}

function ServingNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as ServingNodeData
  const { label = 'Serving', description, icon } = nodeData
  const displayIcon = icon || <CheckCircleOutlined />

  return (
    <div className={styles.nodeWrapper}>
      {/* Target handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Card
        className={`${styles.nodeCard} ${selected ? styles.selected : ''}`}
        size="small"
        hoverable
      >
        <div className={styles.nodeContent}>
          <div className={styles.icon}>{displayIcon}</div>
          <div className={styles.textContent}>
            <Text strong className={styles.label}>
              {label}
            </Text>
            {description && (
              <Text type="secondary" className={styles.description}>
                {description}
              </Text>
            )}
          </div>
        </div>
      </Card>
      {/* Source handles */}
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className={styles.handle}
        style={{ background: '#1890ff' }}
      />
    </div>
  )
}

export const ServingNode = memo(ServingNodeComponent)

