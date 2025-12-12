import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography } from 'antd'
import { FireOutlined } from '@ant-design/icons'
import styles from './cookingNode.module.scss'

const { Text } = Typography

interface CookingNodeData extends Record<string, unknown> {
  label?: string
  description?: string
  icon?: React.ReactNode
}

function CookingNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as CookingNodeData
  const { label = 'Cooking', description, icon } = nodeData
  const displayIcon = icon || <FireOutlined />

  return (
    <div className={styles.nodeWrapper}>
      {/* Target handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
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
        style={{ background: '#ff4d4f' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className={styles.handle}
        style={{ background: '#ff4d4f' }}
      />
    </div>
  )
}

export const CookingNode = memo(CookingNodeComponent)

