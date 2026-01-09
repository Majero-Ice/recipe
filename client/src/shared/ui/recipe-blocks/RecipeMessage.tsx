import { RecipeBlockComponent } from './RecipeBlock'
import type { RecipeBlock } from '@/shared/api/chat/types'
import styles from './recipeMessage.module.scss'

interface RecipeMessageProps {
  blocks: RecipeBlock[]
}

/**
 * Component for displaying structured recipe
 * All parsing logic is executed on the server
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

