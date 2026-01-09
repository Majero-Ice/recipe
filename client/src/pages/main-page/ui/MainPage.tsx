import { useState, useCallback, useRef, useEffect } from 'react'
import { Layout } from 'antd'
import { FlowCanvas } from '@/widgets/flow-canvas/ui/FlowCanvas'
import { ChatSidebar } from '@/widgets/chat-sidebar/ui/ChatSidebar'
import { RecipesSidebar } from '@/widgets/recipes-sidebar/ui/RecipesSidebar'
import { StatsPage } from '@/pages/stats-page'
import { PageNavigation } from '@/features/page-navigation'
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux/hooks'
import { setCurrentPage, setNutritionalInfo } from '@/entities/recipe/model/recipe.slice'
import type { PageType } from '@/entities/recipe/model/recipe.slice'
import { recipeStorage, type SavedRecipe } from '@/shared/lib/localStorage/recipeStorage'
import type { Node, Edge } from '@xyflow/react'
import { message as antMessage } from 'antd'
import styles from './main-page.module.scss'

const { Content } = Layout

export function MainPage() {
  const [flowRecipe, setFlowRecipe] = useState<string | undefined>()
  const [flowMessage, setFlowMessage] = useState<string | undefined>()
  const [savedNodes, setSavedNodes] = useState<Node[] | undefined>()
  const [savedEdges, setSavedEdges] = useState<Edge[] | undefined>()
  const [currentRecipeId, setCurrentRecipeId] = useState<string | undefined>()
  const [currentNodes, setCurrentNodes] = useState<Node[]>([])
  const [currentEdges, setCurrentEdges] = useState<Edge[]>([])
  const [chatMessages, setChatMessages] = useState<Array<{
    id: number
    text: string
    timestamp: Date
    isUser: boolean
    recipe?: any
  }> | undefined>(undefined)
  const [isRecipesSidebarOpen, setIsRecipesSidebarOpen] = useState(false)
  const [refreshRecipesTrigger, setRefreshRecipesTrigger] = useState(0)
  const currentPage = useAppSelector((state) => state.recipe.currentPage)
  const nutritionalInfo = useAppSelector((state) => state.recipe.nutritionalInfo)
  const dispatch = useAppDispatch()
  const previousRecipeIdRef = useRef<string | undefined>(undefined)

  // Auto-save current recipe
  const autoSaveCurrentRecipe = useCallback((recipeId: string, nodes: Node[], edges: Edge[]) => {
    try {
      const savedRecipe = recipeStorage.getById(recipeId)
      if (!savedRecipe) return

      // Convert Date to timestamp for saving
      const chatMessagesToSave = chatMessages?.map((msg) => ({
        ...msg,
        timestamp: (msg.timestamp as any) instanceof Date ? (msg.timestamp as Date).getTime() : (typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()),
      }))

      recipeStorage.update(recipeId, {
        nodes: nodes,
        edges: edges,
        nutritionalInfo: nutritionalInfo || undefined,
        chatMessages: chatMessagesToSave || undefined,
      })

      // Update trigger to refresh list
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      console.error('Error auto-saving recipe:', error)
    }
  }, [chatMessages, nutritionalInfo])

  const handleGenerateFlow = (recipe?: string, message?: string) => {
    // Auto-save previous recipe before generating new one
    if (previousRecipeIdRef.current && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }
    
    setFlowRecipe(recipe)
    setFlowMessage(message)
    // Clear saved data when generating new recipe
    setSavedNodes(undefined)
    setSavedEdges(undefined)
    setCurrentRecipeId(undefined)
    setChatMessages(undefined)
    previousRecipeIdRef.current = undefined
  }

  const handleNewRecipe = useCallback(() => {
    // Auto-save current recipe before creating new one
    if (previousRecipeIdRef.current && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }
    
    // Clear all data for new recipe
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
    setSavedNodes([]) // Set empty array to clear diagram
    setSavedEdges([]) // Set empty array to clear diagram
    setCurrentNodes([]) // Clear diagram (nodes)
    setCurrentEdges([]) // Clear diagram (edges)
    setCurrentRecipeId(undefined)
    setChatMessages(undefined) // Clear chat
    dispatch(setNutritionalInfo(null))
    previousRecipeIdRef.current = undefined
    
    // Close recipes sidebar
    setIsRecipesSidebarOpen(false)
    
    antMessage.success('New recipe created')
  }, [currentNodes, currentEdges, autoSaveCurrentRecipe, dispatch])

  const handleSaveRecipe = (nodes: Node[], edges: Edge[], recipe?: string, message?: string) => {
    // Prevent saving if this is already a loaded recipe
    if (currentRecipeId) {
      antMessage.warning('This recipe is already saved. Changes are saved automatically.')
      return
    }

    try {
      const input = document.getElementById('recipe-name-input') as HTMLInputElement
      const name = input?.value.trim() || `Recipe ${new Date().toLocaleDateString('en-US')}`
      
      // Convert Date to timestamp for saving
      const chatMessagesToSave = chatMessages?.map((msg) => ({
        ...msg,
        timestamp: (msg.timestamp as any) instanceof Date ? (msg.timestamp as Date).getTime() : (typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()),
      }))
      
      const savedRecipe = recipeStorage.save({
        name,
        recipe,
        message,
        nodes,
        edges,
        nutritionalInfo: nutritionalInfo || undefined,
        chatMessages: chatMessagesToSave || undefined,
      })

      // Set current recipe ID
      setCurrentRecipeId(savedRecipe.id)
      previousRecipeIdRef.current = savedRecipe.id
      
      antMessage.success('Recipe saved')
      setIsRecipesSidebarOpen(true)
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      antMessage.error('Failed to save recipe')
      console.error('Error saving recipe:', error)
    }
  }

  const handleLoadRecipe = useCallback((savedRecipe: SavedRecipe) => {
    // Auto-save previous recipe before loading new one
    if (previousRecipeIdRef.current && previousRecipeIdRef.current !== savedRecipe.id && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }

    // Mark as initial load to prevent immediate save
    isInitialLoadRef.current = true

    // Optimize loading: perform all updates synchronously, but use React batching
    // Load diagram directly
    setSavedNodes(savedRecipe.nodes)
    setSavedEdges(savedRecipe.edges)
    setCurrentNodes(savedRecipe.nodes)
    setCurrentEdges(savedRecipe.edges)
    setCurrentRecipeId(savedRecipe.id)
    previousRecipeIdRef.current = savedRecipe.id
    
    // Load charts (nutritional info)
    dispatch(setNutritionalInfo(savedRecipe.nutritionalInfo || null))
    
    // Load chat (convert timestamp back to Date if needed)
    // Use memoization for optimization
    if (savedRecipe.chatMessages && savedRecipe.chatMessages.length > 0) {
      // Convert only if timestamp is a number, otherwise use as is
      const messagesWithDates = savedRecipe.chatMessages.map((msg) => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : (msg.timestamp as Date),
      }))
      setChatMessages(messagesWithDates)
    } else {
      setChatMessages(undefined)
    }
    
    // Clear current recipe and message to avoid reloading flow
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
  }, [dispatch, autoSaveCurrentRecipe, currentNodes, currentEdges])

  const handleNavigate = (page: PageType) => {
    dispatch(setCurrentPage(page))
  }

  // Use useRef to track previous messages
  const previousChatMessagesRef = useRef<string>('')
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isInitialLoadRef = useRef<boolean>(false)
  
  // Memoize callback for onMessagesChange to avoid infinite loops
  const handleMessagesChange = useCallback((msgs: Array<{
    id: number
    text: string
    timestamp: Date
    isUser: boolean
    recipe?: any
  }>) => {
    // Check if messages actually changed
    const newMessagesString = JSON.stringify(msgs)
    if (newMessagesString !== previousChatMessagesRef.current) {
      previousChatMessagesRef.current = newMessagesString
      setChatMessages(msgs)
    }
  }, [])
  
  // Update ref when chatMessages changes externally (e.g., when loading recipe)
  useEffect(() => {
    if (chatMessages) {
      previousChatMessagesRef.current = JSON.stringify(chatMessages)
    } else {
      previousChatMessagesRef.current = ''
    }
  }, [chatMessages])

  // Auto-save when nodes/edges change for current recipe
  useEffect(() => {
    // Don't save on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // Save only if there's a current recipe and there are changes
    if (currentRecipeId && (currentNodes.length > 0 || currentEdges.length > 0)) {
      // Use debounce to avoid frequent saves
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveCurrentRecipe(currentRecipeId, currentNodes, currentEdges)
      }, 2000) // Save 2 seconds after last change

      return () => {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }
      }
    }
  }, [currentNodes, currentEdges, currentRecipeId, autoSaveCurrentRecipe])

  return (
    <Layout className={styles.container}>
      <RecipesSidebar
        isOpen={isRecipesSidebarOpen}
        onToggle={() => setIsRecipesSidebarOpen(!isRecipesSidebarOpen)}
        onLoadRecipe={handleLoadRecipe}
        onNewRecipe={handleNewRecipe}
        refreshTrigger={refreshRecipesTrigger}
      />
      <Content className={styles.content}>
        <div className={styles.pagesContainer}>
          <div
            className={`${styles.page} ${currentPage === 'flow' ? styles.active : styles.inactive} ${currentPage === 'stats' ? styles.slideLeft : ''}`}
          >
            <FlowCanvas
              recipe={flowRecipe}
              message={flowMessage}
              onSave={handleSaveRecipe}
              initialNodes={savedNodes}
              initialEdges={savedEdges}
              onNodesChange={setCurrentNodes}
              onEdgesChange={setCurrentEdges}
              isSavedRecipe={!!currentRecipeId}
            />
          </div>
          <div
            className={`${styles.page} ${currentPage === 'stats' ? styles.active : styles.inactive} ${currentPage === 'flow' ? styles.slideRight : ''}`}
          >
            <StatsPage />
          </div>
        </div>
        <PageNavigation onNavigate={handleNavigate} />
      </Content>
      <ChatSidebar
        onGenerateFlow={handleGenerateFlow}
        initialMessages={chatMessages}
        onMessagesChange={handleMessagesChange}
      />
    </Layout>
  )
}

