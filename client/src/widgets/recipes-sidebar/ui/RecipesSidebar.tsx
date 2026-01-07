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
  refreshTrigger?: number // Триггер для обновления списка
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
    // Сортируем по дате сохранения (новые первыми)
    savedRecipes.sort((a, b) => b.savedAt - a.savedAt)
    setRecipes(savedRecipes)
  }

  const handleDelete = (id: string) => {
    try {
      recipeStorage.delete(id)
      loadRecipes()
      antMessage.success('Рецепт удалён')
    } catch (error) {
      antMessage.error('Не удалось удалить рецепт')
    }
  }

  const handleLoadRecipe = useCallback((recipe: SavedRecipe) => {
    onLoadRecipe(recipe)
    antMessage.success('Рецепт загружен')
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
            <Title level={4} className={styles.title}>Сохранённые рецепты</Title>
            <div className={styles.headerActions}>
              {onNewRecipe && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={onNewRecipe}
                  className={styles.newRecipeButton}
                  title="Создать новый рецепт"
                >
                  Новый
                </Button>
              )}
              <ToggleChatButton isOpen={isOpen} onClick={onToggle} />
            </div>
          </div>
          
          <div className={styles.recipesList}>
            {recipes.length === 0 ? (
              <Empty description="Нет сохранённых рецептов" />
            ) : (
              <List
                dataSource={recipes}
                renderItem={(recipe) => (
                  <List.Item
                    className={styles.recipeItem}
                    actions={[
                      <Popconfirm
                        title="Удалить рецепт?"
                        description="Это действие нельзя отменить"
                        onConfirm={() => handleDelete(recipe.id)}
                        okText="Да"
                        cancelText="Нет"
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
                          {recipe.name || 'Без названия'}
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

