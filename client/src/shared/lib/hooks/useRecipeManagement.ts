import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { setNutritionalInfo } from '@/entities/recipe/model/recipe.slice'
import { recipeStorage, type SavedRecipe } from '../localStorage/recipeStorage'
import type { Node, Edge } from '@xyflow/react'
import { message as antMessage } from 'antd'
import { serializeChatMessages } from '../utils/chatMessages'
import type { ChatMessage } from '../utils/chatMessages'

interface UseRecipeManagementOptions {
  currentNodes: Node[]
  currentEdges: Edge[]
  chatMessages?: ChatMessage[]
  onRecipeChange?: (recipeId: string | undefined) => void
  onInitialLoad?: (data: {
    nodes: Node[]
    edges: Edge[]
    chatMessages?: ChatMessage[]
  }) => void
}

export function useRecipeManagement({
  currentNodes,
  currentEdges,
  chatMessages,
  onRecipeChange,
  onInitialLoad,
}: UseRecipeManagementOptions) {
  const [currentRecipeId, setCurrentRecipeId] = useState<string | undefined>()
  const [refreshRecipesTrigger, setRefreshRecipesTrigger] = useState(0)
  const nutritionalInfo = useAppSelector((state) => state.recipe.nutritionalInfo)
  const dispatch = useAppDispatch()
  const previousRecipeIdRef = useRef<string | undefined>(undefined)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isInitialLoadRef = useRef<boolean>(false)
  const hasInitialLoadedRef = useRef<boolean>(false)
  const onRecipeChangeRef = useRef(onRecipeChange)
  const onInitialLoadRef = useRef(onInitialLoad)

  // Обновляем refs при изменении колбэков
  useEffect(() => {
    onRecipeChangeRef.current = onRecipeChange
    onInitialLoadRef.current = onInitialLoad
  }, [onRecipeChange, onInitialLoad])

  const autoSaveCurrentRecipe = useCallback(
    (recipeId: string, nodes: Node[], edges: Edge[]) => {
      try {
        const savedRecipe = recipeStorage.getById(recipeId)
        if (!savedRecipe) return

        const chatMessagesToSave = serializeChatMessages(chatMessages)

        recipeStorage.update(recipeId, {
          nodes: nodes,
          edges: edges,
          nutritionalInfo: nutritionalInfo || undefined,
          chatMessages: chatMessagesToSave || undefined,
        })

        setRefreshRecipesTrigger((prev) => prev + 1)
      } catch (error) {
        console.error('Error auto-saving recipe:', error)
      }
    },
    [chatMessages, nutritionalInfo]
  )

  const handleSaveRecipe = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      recipe?: string,
      message?: string,
      title?: string
    ) => {
      if (currentRecipeId) {
        antMessage.warning('This recipe is already saved. Changes are saved automatically.')
        return
      }

      try {
        const name = title || `Recipe ${new Date().toLocaleDateString('en-US')}`
        const chatMessagesToSave = serializeChatMessages(chatMessages)

        const savedRecipe = recipeStorage.save({
          name,
          recipe,
          message,
          nodes,
          edges,
          nutritionalInfo: nutritionalInfo || undefined,
          chatMessages: chatMessagesToSave || undefined,
        })

      setCurrentRecipeId(savedRecipe.id)
      previousRecipeIdRef.current = savedRecipe.id
      onRecipeChangeRef.current?.(savedRecipe.id)

      setRefreshRecipesTrigger((prev) => prev + 1)
      return savedRecipe.id
      } catch (error) {
        antMessage.error('Failed to save recipe')
        console.error('Error saving recipe:', error)
        return undefined
      }
    },
    [currentRecipeId, chatMessages, nutritionalInfo]
  )

  const handleDeleteRecipe = useCallback(() => {
    if (!currentRecipeId) return

    try {
      recipeStorage.delete(currentRecipeId)

      setCurrentRecipeId(undefined)
      previousRecipeIdRef.current = undefined
      onRecipeChangeRef.current?.(undefined)

      dispatch(setNutritionalInfo(null))
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      antMessage.error('Failed to delete recipe')
      console.error('Error deleting recipe:', error)
    }
  }, [currentRecipeId, dispatch])

  const handleLoadRecipe = useCallback(
    (savedRecipe: SavedRecipe) => {
      if (
        previousRecipeIdRef.current &&
        previousRecipeIdRef.current !== savedRecipe.id &&
        (currentNodes.length > 0 || currentEdges.length > 0)
      ) {
        autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
      }

      isInitialLoadRef.current = true

      setCurrentRecipeId(savedRecipe.id)
      previousRecipeIdRef.current = savedRecipe.id
      onRecipeChangeRef.current?.(savedRecipe.id)

      dispatch(setNutritionalInfo(savedRecipe.nutritionalInfo || null))

      return {
        nodes: savedRecipe.nodes,
        edges: savedRecipe.edges,
        chatMessages: savedRecipe.chatMessages
          ? savedRecipe.chatMessages.map((msg) => ({
              ...msg,
              timestamp:
                typeof msg.timestamp === 'number'
                  ? new Date(msg.timestamp)
                  : (msg.timestamp as Date),
            }))
          : undefined,
      }
    },
    [dispatch, autoSaveCurrentRecipe, currentNodes, currentEdges]
  )

  const handleNewRecipe = useCallback(() => {
    if (
      previousRecipeIdRef.current &&
      (currentNodes.length > 0 || currentEdges.length > 0)
    ) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }

    setCurrentRecipeId(undefined)
    previousRecipeIdRef.current = undefined
    onRecipeChangeRef.current?.(undefined)

    dispatch(setNutritionalInfo(null))
    antMessage.success('New recipe created')
  }, [currentNodes, currentEdges, autoSaveCurrentRecipe, dispatch])

  // Автосохранение при изменении nodes, edges или chatMessages
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    if (
      currentRecipeId &&
      ((currentNodes.length > 0 || currentEdges.length > 0) ||
        (chatMessages && chatMessages.length > 0))
    ) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveCurrentRecipe(currentRecipeId, currentNodes, currentEdges)
      }, 2000)

      return () => {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }
      }
    }
  }, [currentNodes, currentEdges, chatMessages, currentRecipeId, autoSaveCurrentRecipe])

  // Загрузка сохраненного рецепта при монтировании (только один раз)
  useEffect(() => {
    if (hasInitialLoadedRef.current) return
    hasInitialLoadedRef.current = true

    const savedCurrentRecipeId = localStorage.getItem('currentRecipeId')
    if (savedCurrentRecipeId) {
      const savedRecipe = recipeStorage.getById(savedCurrentRecipeId)
      if (savedRecipe) {
        isInitialLoadRef.current = true
        setCurrentRecipeId(savedRecipe.id)
        previousRecipeIdRef.current = savedRecipe.id
        onRecipeChangeRef.current?.(savedRecipe.id)
        dispatch(setNutritionalInfo(savedRecipe.nutritionalInfo || null))

        const chatMessagesData = savedRecipe.chatMessages
          ? savedRecipe.chatMessages.map((msg) => ({
              ...msg,
              timestamp:
                typeof msg.timestamp === 'number'
                  ? new Date(msg.timestamp)
                  : (msg.timestamp as Date),
            }))
          : undefined

        onInitialLoadRef.current?.({
          nodes: savedRecipe.nodes,
          edges: savedRecipe.edges,
          chatMessages: chatMessagesData,
        })
      } else {
        localStorage.removeItem('currentRecipeId')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Сохранение currentRecipeId в localStorage
  useEffect(() => {
    if (currentRecipeId) {
      localStorage.setItem('currentRecipeId', currentRecipeId)
    } else {
      localStorage.removeItem('currentRecipeId')
    }
  }, [currentRecipeId])

  return {
    currentRecipeId,
    refreshRecipesTrigger,
    handleSaveRecipe,
    handleDeleteRecipe,
    handleLoadRecipe,
    handleNewRecipe,
    autoSaveCurrentRecipe,
  }
}

