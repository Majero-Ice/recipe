import { RecipeBlockComponent } from './RecipeBlock'
import type { RecipeBlock } from '@/shared/api/chat/types'
import styles from './recipeMessage.module.scss'

interface RecipeMessageProps {
  blocks: RecipeBlock[]
}

/**
 * Компонент для отображения структурированного рецепта
 * Вся логика парсинга выполняется на сервере
 */
export function RecipeMessage({ blocks }: RecipeMessageProps) {
  if (blocks.length === 0) {
    return null
  }

  return (
    <div className={styles.recipeMessage}>
      {blocks.map((block, index) => (
        <RecipeBlockComponent key={index} block={block} />
      ))}
    </div>
  )
}

