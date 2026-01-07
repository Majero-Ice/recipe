import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography, Input } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import styles from './servingNode.module.scss'

const { Text } = Typography
const { TextArea } = Input

interface ServingNodeData extends Record<string, unknown> {
  label?: string
  description?: string
  icon?: React.ReactNode
  onLabelChange?: (newLabel: string) => void
  onDescriptionChange?: (newDescription: string) => void
}

function ServingNodeComponent({ data, selected, id }: NodeProps) {
  const nodeData = data as ServingNodeData
  const { label = 'Serving', description, icon, onLabelChange, onDescriptionChange } = nodeData
  const displayIcon = icon || <CheckCircleOutlined />
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
            {isEditingLabel ? (
              <Input
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                onBlur={handleLabelBlur}
                onKeyDown={handleLabelKeyDown}
                autoFocus
                className={styles.editInput}
                size="small"
              />
            ) : (
              <Text 
                strong 
                className={styles.label}
                onDoubleClick={handleLabelDoubleClick}
                title="Двойной клик для редактирования"
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
                autoFocus
                autoSize={{ minRows: 1, maxRows: 4 }}
                className={styles.editTextarea}
                size="small"
                placeholder="Описание (двойной клик для редактирования)"
              />
            ) : (
              <Text 
                type="secondary" 
                className={styles.description}
                onDoubleClick={handleDescriptionDoubleClick}
                title="Двойной клик для редактирования"
                style={{ 
                  minHeight: description ? 'auto' : '20px',
                  cursor: 'text',
                  fontStyle: description ? 'normal' : 'italic',
                  opacity: description ? 1 : 0.5
                }}
              >
                {description || 'Двойной клик, чтобы добавить описание'}
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

