export interface ChatRequest {
  message: string
  history?: Array<{ role: string; content: string }>
}

export enum RecipeBlockType {
  INGREDIENTS = 'ingredients',
  PREPARATION = 'preparation',
  COOKING = 'cooking',
  SERVING = 'serving',
}

export interface RecipeBlock {
  type: RecipeBlockType
  title: string
  content: string
}

export interface StructuredRecipe {
  isRecipe: boolean
  originalMessage: string
  blocks: RecipeBlock[]
}

export interface ChatResponse {
  message: string
  model: string
  recipe?: StructuredRecipe
}


