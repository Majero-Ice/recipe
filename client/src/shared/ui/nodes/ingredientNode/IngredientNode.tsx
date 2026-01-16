import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Typography, Input, Button, Space } from 'antd'
import { ShoppingOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
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
  onIngredientsChange?: (ingredients: Ingredient[]) => void
}

function IngredientNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as IngredientNodeData
  const { label = 'Ingredients', description, icon, ingredients = [], onLabelChange, onDescriptionChange, onIngredientsChange } = nodeData
  const [isExpanded, setIsExpanded] = useState(false)
  const [listPosition, setListPosition] = useState({ x: 0, y: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)
  const displayIcon = icon || <ShoppingOutlined />
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedLabel, setEditedLabel] = useState(label)
  const [editedDescription, setEditedDescription] = useState(description || '')
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [newIngredient, setNewIngredient] = useState({ name: '', quantity: '' })
  const [isAddingIngredient, setIsAddingIngredient] = useState(false)

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
    // If Ctrl or Meta key is pressed, don't open the list - allow edge creation
    if (e.ctrlKey || e.metaKey) {
      // Don't stop propagation - let ReactFlow handle the click for edge creation
      return
    }
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleAddIngredient = useCallback(() => {
    if (!newIngredient.name.trim()) {
      return
    }
    
    if (!onIngredientsChange) {
      console.error('onIngredientsChange is not defined for ingredient node')
      return
    }
    
    const updatedIngredients = [...ingredients, { ...newIngredient }]
    onIngredientsChange(updatedIngredients)
    setNewIngredient({ name: '', quantity: '' })
    setIsAddingIngredient(false)
  }, [newIngredient, ingredients, onIngredientsChange])

  const handleDeleteIngredient = useCallback((index: number) => {
    if (onIngredientsChange) {
      const updatedIngredients = ingredients.filter((_, i) => i !== index)
      onIngredientsChange(updatedIngredients)
      if (editingIngredientIndex === index) {
        setEditingIngredientIndex(null)
        setEditingIngredient(null)
      }
    }
  }, [ingredients, onIngredientsChange, editingIngredientIndex])

  const handleSaveEditIngredient = useCallback(() => {
    if (editingIngredientIndex === null || !editingIngredient) {
      return
    }
    
    if (!onIngredientsChange) {
      console.error('onIngredientsChange is not defined for ingredient node')
      return
    }
    
    const updatedIngredients = ingredients.map((ing, i) => 
      i === editingIngredientIndex ? { ...editingIngredient } : ing
    )
    onIngredientsChange(updatedIngredients)
    setEditingIngredientIndex(null)
    setEditingIngredient(null)
  }, [editingIngredientIndex, editingIngredient, ingredients, onIngredientsChange])

  const handleUpdateEditingIngredient = useCallback((field: 'name' | 'quantity', value: string) => {
    if (editingIngredient) {
      setEditingIngredient({ ...editingIngredient, [field]: value })
    }
  }, [editingIngredient])

  const handleStartEditIngredient = useCallback((index: number) => {
    const ingredient = ingredients[index]
    if (ingredient) {
      setEditingIngredientIndex(index)
      setEditingIngredient({ ...ingredient })
      setIsAddingIngredient(false)
    }
  }, [ingredients])

  const handleCancelEditIngredient = useCallback(() => {
    setEditingIngredientIndex(null)
    setEditingIngredient(null)
  }, [])

  const handleStartAddIngredient = useCallback(() => {
    setIsAddingIngredient(true)
    setEditingIngredientIndex(null)
  }, [])

  return (
    <div className={styles.nodeWrapper} ref={nodeRef}>
      {/* Single invisible center handle for target */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className={styles.centerHandle}
      />
      <Card
        className={`${styles.nodeCard} ${selected ? styles.selected : ''} ${styles.clickable}`}
        size="small"
        hoverable
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
            <Text type="secondary" className={styles.ingredientCount}>
              {ingredients.length} {ingredients.length === 1 ? 'ingredient' : 'ingredients'}
            </Text>
          </div>
        </div>
      </Card>
      {isExpanded && createPortal(
        <div 
          className={styles.ingredientList}
          style={{
            position: 'fixed',
            left: `${listPosition.x}px`,
            top: `${listPosition.y}px`,
            zIndex: 10000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Card 
            size="small" 
            className={styles.listCard}
            title={
              <div className={styles.listHeader}>
                <Text strong>Ingredients</Text>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleStartAddIngredient}
                >
                  Add
                </Button>
              </div>
            }
          >
            <div className={styles.ingredientsList}>
              {ingredients.map((item, index) => (
                <div key={index} className={styles.listItem}>
                  {editingIngredientIndex === index && editingIngredient ? (
                    <div className={styles.editIngredientForm}>
                      <Input
                        value={editingIngredient.name}
                        onChange={(e) => handleUpdateEditingIngredient('name', e.target.value)}
                        placeholder="Ingredient name"
                        size="small"
                        style={{ marginBottom: 8 }}
                        onPressEnter={handleSaveEditIngredient}
                      />
                      <Input
                        value={editingIngredient.quantity}
                        onChange={(e) => handleUpdateEditingIngredient('quantity', e.target.value)}
                        placeholder="Quantity"
                        size="small"
                        onPressEnter={handleSaveEditIngredient}
                      />
                      <Space size="small" style={{ marginTop: 8 }}>
                        <Button
                          type="primary"
                          size="small"
                          onClick={handleSaveEditIngredient}
                          disabled={!editingIngredient?.name.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          onClick={handleCancelEditIngredient}
                        >
                          Cancel
                        </Button>
                      </Space>
                    </div>
                  ) : (
                    <>
                      <div className={styles.ingredientContent}>
                        <div className={styles.ingredientName}>
                          {item.name}
                        </div>
                        <span className={styles.ingredientQuantity}>
                          {item.quantity}
                        </span>
                      </div>
                      <Space size="small" className={styles.itemActions}>
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleStartEditIngredient(index)}
                        />
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteIngredient(index)}
                        />
                      </Space>
                    </>
                  )}
                </div>
              ))}
            </div>
            {isAddingIngredient && (
              <div className={styles.addIngredientForm}>
                <Input
                  value={newIngredient.name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  placeholder="Ingredient name"
                  size="small"
                  style={{ marginBottom: 8 }}
                  onPressEnter={handleAddIngredient}
                  autoFocus
                />
                <Input
                  value={newIngredient.quantity}
                  onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                  placeholder="Quantity"
                  size="small"
                  style={{ marginBottom: 8 }}
                  onPressEnter={handleAddIngredient}
                />
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleAddIngredient}
                    disabled={!newIngredient.name.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setIsAddingIngredient(false)
                      setNewIngredient({ name: '', quantity: '' })
                    }}
                  >
                    Cancel
                  </Button>
                </Space>
              </div>
            )}
          </Card>
        </div>,
        document.body
      )}
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

export const IngredientNode = memo(IngredientNodeComponent)

