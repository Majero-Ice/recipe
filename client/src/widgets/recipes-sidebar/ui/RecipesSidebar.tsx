import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout, Typography, Empty, List, Button, Popconfirm, Input, message as antMessage } from 'antd'
import { DeleteOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import { ToggleChatButton } from '@/features/toggle-chat/ui/ToggleChatButton'
import { recipeStorage, type SavedRecipe } from '@/shared/lib/localStorage/recipeStorage'
import styles from './recipes-sidebar.module.scss'

const { Sider } = Layout
const { Title } = Typography

interface RecipesSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onLoadRecipe: (recipe: SavedRecipe) => void
  onNewRecipe?: () => void
  refreshTrigger?: number // Trigger to refresh the list
}

const DEFAULT_WIDTH = 300

export function RecipesSidebar({ isOpen, onToggle, onLoadRecipe, onNewRecipe, refreshTrigger }: RecipesSidebarProps) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([])
  const [sidebarWidth] = useState(DEFAULT_WIDTH)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const inputRef = useRef<any>(null)

  useEffect(() => {
    loadRecipes()
  }, [refreshTrigger])

  const loadRecipes = () => {
    const savedRecipes = recipeStorage.getAll()
    // Sort by save date (newest first)
    savedRecipes.sort((a, b) => b.savedAt - a.savedAt)
    setRecipes(savedRecipes)
  }

  const handleDelete = (id: string) => {
    try {
      recipeStorage.delete(id)
      loadRecipes()
      antMessage.success('Recipe deleted')
    } catch (error) {
      antMessage.error('Failed to delete recipe')
    }
  }

  const handleLoadRecipe = useCallback((recipe: SavedRecipe) => {
    onLoadRecipe(recipe)
    antMessage.success('Recipe loaded')
  }, [onLoadRecipe])

  const handleStartEdit = (recipe: SavedRecipe, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(recipe.id)
    setEditingName(recipe.name || 'Untitled')
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const handleSaveEdit = (id: string) => {
    const trimmedName = editingName.trim()
    if (!trimmedName) {
      antMessage.warning('Recipe name cannot be empty')
      setEditingId(null)
      return
    }

    try {
      recipeStorage.update(id, { name: trimmedName })
      loadRecipes()
      setEditingId(null)
      antMessage.success('Recipe renamed')
    } catch (error) {
      antMessage.error('Failed to rename recipe')
      console.error('Error renaming recipe:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  return (
    <>
      <Sider
        className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
        width={sidebarWidth}
        theme="light"
        style={{ width: sidebarWidth }}
      >
        <div className={styles.content}>
          <div className={styles.header}>
            <Title level={4} className={styles.title}>Saved Recipes</Title>
            <div className={styles.headerActions}>
              {onNewRecipe && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={onNewRecipe}
                  className={styles.newRecipeButton}
                  title="Create new recipe"
                >
                  New
                </Button>
              )}
              <ToggleChatButton isOpen={isOpen} onClick={onToggle} />
            </div>
          </div>
          
          <div className={styles.recipesList}>
            {recipes.length === 0 ? (
              <Empty description="No saved recipes" />
            ) : (
              <List
                dataSource={recipes}
                renderItem={(recipe) => (
                  <List.Item
                    className={styles.recipeItem}
                    actions={[
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        size="small"
                        onClick={(e) => handleStartEdit(recipe, e)}
                        key="edit"
                        title="Rename recipe"
                      />,
                      <Popconfirm
                        title="Delete recipe?"
                        description="This action cannot be undone"
                        onConfirm={() => handleDelete(recipe.id)}
                        okText="Yes"
                        cancelText="No"
                        key="delete"
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                        />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        editingId === recipe.id ? (
                          <Input
                            ref={inputRef}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleSaveEdit(recipe.id)}
                            onKeyDown={(e) => handleKeyDown(e, recipe.id)}
                            className={styles.editInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div
                            className={styles.recipeTitle}
                            onClick={() => handleLoadRecipe(recipe)}
                            onDoubleClick={(e) => handleStartEdit(recipe, e)}
                            title="Double-click to rename"
                          >
                            {recipe.name || 'Untitled'}
                          </div>
                        )
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
      </Sider>
      {!isOpen && (
        <div className={styles.toggleButton}>
          <ToggleChatButton isOpen={isOpen} onClick={onToggle} />
        </div>
      )}
    </>
  )
}

