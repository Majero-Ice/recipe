import { createSlice } from '@reduxjs/toolkit'
import type { NutritionalInfo } from '@/shared/api/recipe-flow/types'

export type PageType = 'flow' | 'stats'

interface RecipeState {
  currentPage: PageType
  nutritionalInfo: NutritionalInfo | null
}

const initialState: RecipeState = {
  currentPage: 'flow',
  nutritionalInfo: null,
}

export const recipeSlice = createSlice({
  name: 'recipe',
  initialState,
  reducers: {
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload
    },
    setNutritionalInfo: (state, action) => {
      state.nutritionalInfo = action.payload
    },
  },
})

export const { setCurrentPage, setNutritionalInfo } = recipeSlice.actions

