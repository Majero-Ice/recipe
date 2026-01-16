export interface RecipeFlowRequest {
  recipe?: string
  message?: string
  structuredRecipe?: import('../chat/types').StructuredRecipe
}

export interface FlowNode {
  id: string
  type: string
  position: {
    x: number
    y: number
  }
  data: {
    label: string
    description?: string
    [key: string]: any
  }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
  time?: string
  type?: string
  [key: string]: any
}

export interface NutritionalInfo {
  calories: number
  protein: number
  fat: number
  carbohydrates: number
  fiber?: number
  sugar?: number
  sodium?: number
}

export interface RecipeFlowResponse {
  title?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  nutritionalInfo?: NutritionalInfo
}




