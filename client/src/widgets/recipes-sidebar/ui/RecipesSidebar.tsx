import { useState, useEffect, useCallback } from 'react'
import { Layout, Typography, Empty, List, Button, Popconfirm, message as antMessage } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
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
                        <div
                          className={styles.recipeTitle}
                          onClick={() => handleLoadRecipe(recipe)}
                        >
                          {recipe.name || 'Untitled'}
                        </div>
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

