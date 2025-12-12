import { memo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography, List } from 'antd'
import { ShoppingOutlined } from '@ant-design/icons'
import styles from './ingredientNode.module.scss'

const { Text } = Typography

export interface Ingredient {
  name: string
  quantity: string
}

interface IngredientNodeData extends Record<string, unknown> {
  label?: string
  description?: string
  icon?: React.ReactNode
  ingredients?: Ingredient[]
}

function IngredientNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as IngredientNodeData
  const { label = 'Ingredients', description, icon, ingredients = [] } = nodeData
  const [isExpanded, setIsExpanded] = useState(false)
  const [listPosition, setListPosition] = useState({ x: 0, y: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)
  const displayIcon = icon || <ShoppingOutlined />

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement
        if (!target.closest(`.${styles.ingredientList}`)) {
          setIsExpanded(false)
        }
      }
    }

    if (isExpanded && nodeRef.current) {
      // Calculate absolute position of the node
      const rect = nodeRef.current.getBoundingClientRect()
      setListPosition({
        x: rect.left,
        y: rect.bottom + 8,
      })
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (ingredients.length > 0) {
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className={styles.nodeWrapper} ref={nodeRef}>
      {/* Target handles - can receive connections from all sides */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Card
        className={`${styles.nodeCard} ${selected ? styles.selected : ''} ${ingredients.length > 0 ? styles.clickable : ''}`}
        size="small"
        hoverable={ingredients.length > 0}
        onClick={handleCardClick}
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
            {ingredients.length > 0 && (
              <Text type="secondary" className={styles.ingredientCount}>
                {ingredients.length} {ingredients.length === 1 ? 'ingredient' : 'ingredients'}
              </Text>
            )}
          </div>
        </div>
      </Card>
      {isExpanded && ingredients.length > 0 && createPortal(
        <div 
          className={styles.ingredientList}
          style={{
            position: 'fixed',
            left: `${listPosition.x}px`,
            top: `${listPosition.y}px`,
            zIndex: 10000,
          }}
        >
          <Card size="small" className={styles.listCard}>
            <List
              size="small"
              dataSource={ingredients}
              renderItem={(item) => (
                <List.Item className={styles.listItem}>
                  <Text strong className={styles.ingredientName}>
                    {item.name}
                  </Text>
                  <Text className={styles.ingredientQuantity}>
                    {item.quantity}
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        </div>,
        document.body
      )}
      {/* Source handles - can send connections to all sides */}
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className={styles.handle}
        style={{ background: '#52c41a' }}
      />
    </div>
  )
}

export const IngredientNode = memo(IngredientNodeComponent)

