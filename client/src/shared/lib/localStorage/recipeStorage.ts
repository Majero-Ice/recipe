import type { Node, Edge } from '@xyflow/react'
import type { NutritionalInfo } from '@/shared/api/recipe-flow/types'
import type { StructuredRecipe } from '@/shared/api/chat/types'

export interface SavedRecipe {
  id: string
  name: string
  savedAt: number
  recipe?: string
  message?: string
  nodes: Node[]
  edges: Edge[]
  nutritionalInfo?: NutritionalInfo
  chatMessages?: Array<{
    id: number
    text: string
    timestamp: number // Сохраняем как timestamp для сериализации
    isUser: boolean
    recipe?: StructuredRecipe
  }>
}

const STORAGE_KEY = 'saved_recipes'

export const recipeStorage = {
  /**
   * Получить все сохранённые рецепты
   */
  getAll(): SavedRecipe[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []
      return JSON.parse(data)
    } catch (error) {
      console.error('Error loading recipes from localStorage:', error)
      return []
    }
  },

  /**
   * Сохранить рецепт
   */
  save(recipe: Omit<SavedRecipe, 'id' | 'savedAt'>): SavedRecipe {
    const savedRecipe: SavedRecipe = {
      ...recipe,
      id: `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      savedAt: Date.now(),
    }

    const recipes = this.getAll()
    recipes.push(savedRecipe)
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
    } catch (error) {
      console.error('Error saving recipe to localStorage:', error)
      throw new Error('Failed to save recipe')
    }

    return savedRecipe
  },

  /**
   * Удалить рецепт
   */
  delete(id: string): void {
    const recipes = this.getAll().filter((r) => r.id !== id)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
    } catch (error) {
      console.error('Error deleting recipe from localStorage:', error)
      throw new Error('Failed to delete recipe')
    }
  },

  /**
   * Получить рецепт по ID
   */
  getById(id: string): SavedRecipe | null {
    const recipes = this.getAll()
    const recipe = recipes.find((r) => r.id === id)
    if (!recipe) return null
    
    // Преобразуем timestamp обратно в Date для chatMessages
    if (recipe.chatMessages) {
      recipe.chatMessages = recipe.chatMessages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })) as any
    }
    
    return recipe
  },

  /**
   * Обновить рецепт
   */
  update(id: string, updates: Partial<SavedRecipe>): SavedRecipe | null {
    const recipes = this.getAll()
    const index = recipes.findIndex((r) => r.id === id)
    
    if (index === -1) return null

    recipes[index] = { ...recipes[index], ...updates }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
      return recipes[index]
    } catch (error) {
      console.error('Error updating recipe in localStorage:', error)
      throw new Error('Failed to update recipe')
    }
  },
}

