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
import type { StructuredRecipe } from '@/shared/api/chat/types'
import styles from './main-page.module.scss'

const { Content } = Layout

export function MainPage() {
  const [flowRecipe, setFlowRecipe] = useState<string | undefined>()
  const [flowMessage, setFlowMessage] = useState<string | undefined>()
  const [flowStructuredRecipe, setFlowStructuredRecipe] = useState<StructuredRecipe | undefined>()
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

  const autoSaveCurrentRecipe = useCallback((recipeId: string, nodes: Node[], edges: Edge[]) => {
    try {
      const savedRecipe = recipeStorage.getById(recipeId)
      if (!savedRecipe) return

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

      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      console.error('Error auto-saving recipe:', error)
    }
  }, [chatMessages, nutritionalInfo])

  const handleGenerateFlow = (structuredRecipe?: StructuredRecipe) => {
    if (currentRecipeId && (currentNodes.length > 0 || currentEdges.length > 0 || chatMessages)) {
      autoSaveCurrentRecipe(currentRecipeId, currentNodes, currentEdges)
    } else if (previousRecipeIdRef.current && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }
    
    if (structuredRecipe && structuredRecipe.blocks && structuredRecipe.blocks.length > 0) {
      setFlowStructuredRecipe(structuredRecipe)
      const recipeText = structuredRecipe.blocks
        .map((block) => `## ${block.title}\n${block.content}`)
        .join('\n\n')
      setFlowRecipe(recipeText)
    } else {
      setFlowRecipe(undefined)
      setFlowStructuredRecipe(undefined)
    }
    setFlowMessage(undefined)
    setSavedNodes(undefined)
    setSavedEdges(undefined)
    if (!currentRecipeId) {
      setCurrentRecipeId(undefined)
      setChatMessages(undefined)
      previousRecipeIdRef.current = undefined
    }
  }

  const handleGenerateDiagram = useCallback((recipe?: string, message?: string) => {
    if (currentRecipeId && (currentNodes.length > 0 || currentEdges.length > 0 || chatMessages)) {
      autoSaveCurrentRecipe(currentRecipeId, currentNodes, currentEdges)
    }
    
    setFlowRecipe(recipe)
    setFlowMessage(message)
    setSavedNodes(undefined)
    setSavedEdges(undefined)
  }, [currentRecipeId, currentNodes, currentEdges, chatMessages, autoSaveCurrentRecipe])

  const handleNewRecipe = useCallback(() => {
    if (previousRecipeIdRef.current && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }
    
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
    setSavedNodes([])
    setSavedEdges([])
    setCurrentNodes([])
    setCurrentEdges([])
    setCurrentRecipeId(undefined)
    setChatMessages(undefined)
    dispatch(setNutritionalInfo(null))
    previousRecipeIdRef.current = undefined
    
    setIsRecipesSidebarOpen(false)
    
    antMessage.success('New recipe created')
  }, [currentNodes, currentEdges, autoSaveCurrentRecipe, dispatch])

  const handleSaveRecipe = (nodes: Node[], edges: Edge[], recipe?: string, message?: string, title?: string) => {
    if (currentRecipeId) {
      antMessage.warning('This recipe is already saved. Changes are saved automatically.')
      return
    }

    try {
      const name = title || `Recipe ${new Date().toLocaleDateString('en-US')}`
      
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

      setCurrentRecipeId(savedRecipe.id)
      previousRecipeIdRef.current = savedRecipe.id
      
      setIsRecipesSidebarOpen(true)
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      antMessage.error('Failed to save recipe')
      console.error('Error saving recipe:', error)
    }
  }

  const handleDeleteRecipe = useCallback(() => {
    if (!currentRecipeId) return

    try {
      recipeStorage.delete(currentRecipeId)
      
      setCurrentRecipeId(undefined)
      previousRecipeIdRef.current = undefined
      setSavedNodes([])
      setSavedEdges([])
      setCurrentNodes([])
      setCurrentEdges([])
      setFlowRecipe(undefined)
      setFlowMessage(undefined)
      setChatMessages(undefined)
      dispatch(setNutritionalInfo(null))
      
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      antMessage.error('Failed to delete recipe')
      console.error('Error deleting recipe:', error)
    }
  }, [currentRecipeId, dispatch])

  const handleLoadRecipe = useCallback((savedRecipe: SavedRecipe) => {
    if (previousRecipeIdRef.current && previousRecipeIdRef.current !== savedRecipe.id && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current, currentNodes, currentEdges)
    }

    isInitialLoadRef.current = true

    setSavedNodes(savedRecipe.nodes)
    setSavedEdges(savedRecipe.edges)
    setCurrentNodes(savedRecipe.nodes)
    setCurrentEdges(savedRecipe.edges)
    setCurrentRecipeId(savedRecipe.id)
    previousRecipeIdRef.current = savedRecipe.id
    
    dispatch(setNutritionalInfo(savedRecipe.nutritionalInfo || null))
    
    if (savedRecipe.chatMessages && savedRecipe.chatMessages.length > 0) {
      const messagesWithDates = savedRecipe.chatMessages.map((msg) => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : (msg.timestamp as Date),
      }))
      setChatMessages(messagesWithDates)
    } else {
      setChatMessages(undefined)
    }
    
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
  }, [dispatch, autoSaveCurrentRecipe, currentNodes, currentEdges])

  const handleNavigate = (page: PageType) => {
    dispatch(setCurrentPage(page))
  }

  const previousChatMessagesRef = useRef<string>('')
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isInitialLoadRef = useRef<boolean>(false)
  
  const handleMessagesChange = useCallback((msgs: Array<{
    id: number
    text: string
    timestamp: Date
    isUser: boolean
    recipe?: any
  }>) => {
    const newMessagesString = JSON.stringify(msgs)
    if (newMessagesString !== previousChatMessagesRef.current) {
      previousChatMessagesRef.current = newMessagesString
      setChatMessages(msgs)
    }
  }, [])

  useEffect(() => {
    if (chatMessages) {
      previousChatMessagesRef.current = JSON.stringify(chatMessages)
    } else {
      previousChatMessagesRef.current = ''
    }
  }, [chatMessages])

  useEffect(() => {
    const savedCurrentRecipeId = localStorage.getItem('currentRecipeId')
    if (savedCurrentRecipeId) {
      const savedRecipe = recipeStorage.getById(savedCurrentRecipeId)
      if (savedRecipe) {
        isInitialLoadRef.current = true
        
        setSavedNodes(savedRecipe.nodes)
        setSavedEdges(savedRecipe.edges)
        setCurrentNodes(savedRecipe.nodes)
        setCurrentEdges(savedRecipe.edges)
        setCurrentRecipeId(savedRecipe.id)
        previousRecipeIdRef.current = savedRecipe.id
        
        dispatch(setNutritionalInfo(savedRecipe.nutritionalInfo || null))
        
        if (savedRecipe.chatMessages && savedRecipe.chatMessages.length > 0) {
          const messagesWithDates = savedRecipe.chatMessages.map((msg) => ({
            ...msg,
            timestamp: typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : (msg.timestamp as Date),
          }))
          setChatMessages(messagesWithDates)
        }
      } else {
        localStorage.removeItem('currentRecipeId')
      }
    }
  }, [dispatch])

  useEffect(() => {
    if (currentRecipeId) {
      localStorage.setItem('currentRecipeId', currentRecipeId)
    } else {
      localStorage.removeItem('currentRecipeId')
    }
  }, [currentRecipeId])

  useEffect(() => {
    if (currentRecipeId && currentNodes.length > 0 && currentEdges.length > 0) {
      setSavedNodes(currentNodes)
      setSavedEdges(currentEdges)
    }
  }, [currentNodes, currentEdges, currentRecipeId])

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    if (currentRecipeId && ((currentNodes.length > 0 || currentEdges.length > 0) || (chatMessages && chatMessages.length > 0))) {
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
              structuredRecipe={flowStructuredRecipe}
              onSave={handleSaveRecipe}
              onDelete={handleDeleteRecipe}
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
        onGenerateDiagram={handleGenerateDiagram}
        initialMessages={chatMessages}
        onMessagesChange={handleMessagesChange}
      />
    </Layout>
  )
}

