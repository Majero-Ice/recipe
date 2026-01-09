import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography, List, Input } from 'antd'
import { ShoppingOutlined } from '@ant-design/icons'
import styles from './ingredientNode.module.scss'

const { Text } = Typography
const { TextArea } = Input

export interface Ingredient {
  name: string
  quantity: string
}

interface IngredientNodeData extends Record<string, unknown> {
  label?: string
  description?: string
  icon?: React.ReactNode
  ingredients?: Ingredient[]
  onLabelChange?: (newLabel: string) => void
  onDescriptionChange?: (newDescription: string) => void
}

function IngredientNodeComponent({ data, selected, id }: NodeProps) {
  const nodeData = data as IngredientNodeData
  const { label = 'Ingredients', description, icon, ingredients = [], onLabelChange, onDescriptionChange } = nodeData
  const [isExpanded, setIsExpanded] = useState(false)
  const [listPosition, setListPosition] = useState({ x: 0, y: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)
  const displayIcon = icon || <ShoppingOutlined />
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedLabel, setEditedLabel] = useState(label)
  const [editedDescription, setEditedDescription] = useState(description || '')

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingLabel(true)
  }, [])

  const handleDescriptionDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingDescription(true)
  }, [])

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false)
    if (onLabelChange && editedLabel !== label) {
      onLabelChange(editedLabel)
    }
  }, [editedLabel, label, onLabelChange])

  const handleDescriptionBlur = useCallback(() => {
    setIsEditingDescription(false)
    if (onDescriptionChange && editedDescription !== description) {
      onDescriptionChange(editedDescription)
    }
  }, [editedDescription, description, onDescriptionChange])

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleLabelBlur()
    }
  }, [handleLabelBlur])

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleDescriptionBlur()
    }
  }, [handleDescriptionBlur])

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
            {isEditingLabel ? (
              <Input
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                onBlur={handleLabelBlur}
                onKeyDown={handleLabelKeyDown}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className={styles.editInput}
                size="small"
              />
            ) : (
              <Text 
                strong 
                className={styles.label}
                onDoubleClick={handleLabelDoubleClick}
                title="Double click to edit"
              >
                {label}
              </Text>
            )}
            {isEditingDescription ? (
              <TextArea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                onKeyDown={handleDescriptionKeyDown}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                autoSize={{ minRows: 1, maxRows: 4 }}
                className={styles.editTextarea}
                size="small"
                placeholder="Description (double click to edit)"
              />
            ) : (
              <Text 
                type="secondary" 
                className={styles.description}
                onDoubleClick={handleDescriptionDoubleClick}
                title="Double click to edit"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  minHeight: description ? 'auto' : '20px',
                  cursor: 'text',
                  fontStyle: description ? 'normal' : 'italic',
                  opacity: description ? 1 : 0.5
                }}
              >
                {description || 'Double click to add description'}
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

