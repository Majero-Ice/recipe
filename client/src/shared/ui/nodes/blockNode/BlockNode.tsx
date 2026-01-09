import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography, Input } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import styles from './blockNode.module.scss'

const { Text } = Typography
const { TextArea } = Input

interface BlockNodeData extends Record<string, unknown> {
  label?: string
  description?: string
  icon?: React.ReactNode
  onLabelChange?: (newLabel: string) => void
  onDescriptionChange?: (newDescription: string) => void
}

function BlockNodeComponent({ data, selected, id }: NodeProps) {
  const nodeData = data as BlockNodeData
  const { label = 'Block', description, icon, onLabelChange, onDescriptionChange } = nodeData
  const displayIcon = icon || <FolderOutlined />
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

  return (
    <div className={styles.nodeWrapper}>
      {/* Single invisible center handle for target */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className={styles.centerHandle}
      />
      <Card
        className={`${styles.nodeCard} ${selected ? styles.selected : ''}`}
        size="small"
        hoverable
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
          </div>
        </div>
      </Card>
      {/* Single invisible center handle for source */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className={styles.centerHandle}
      />
    </div>
  )
}

export const BlockNode = memo(BlockNodeComponent)

