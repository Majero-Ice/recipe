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

  // Автоматическое сохранение текущего рецепта
  const autoSaveCurrentRecipe = useCallback((recipeId: string) => {
    try {
      const savedRecipe = recipeStorage.getById(recipeId)
      if (!savedRecipe) return

      // Преобразуем Date в timestamp для сохранения
      const chatMessagesToSave = chatMessages?.map((msg) => ({
        ...msg,
        timestamp: (msg.timestamp as any) instanceof Date ? (msg.timestamp as Date).getTime() : (typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()),
      }))

      recipeStorage.update(recipeId, {
        nodes: currentNodes,
        edges: currentEdges,
        nutritionalInfo: nutritionalInfo || undefined,
        chatMessages: chatMessagesToSave || undefined,
      })

      // Обновляем trigger для обновления списка
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      console.error('Error auto-saving recipe:', error)
    }
  }, [currentNodes, currentEdges, chatMessages, nutritionalInfo])

  const handleGenerateFlow = (recipe?: string, message?: string) => {
    // Автоматически сохраняем предыдущий рецепт перед генерацией нового
    if (previousRecipeIdRef.current && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current)
    }
    
    setFlowRecipe(recipe)
    setFlowMessage(message)
    // Очищаем сохранённые данные при генерации нового рецепта
    setSavedNodes(undefined)
    setSavedEdges(undefined)
    setCurrentRecipeId(undefined)
    setChatMessages(undefined)
    previousRecipeIdRef.current = undefined
  }

  const handleNewRecipe = useCallback(() => {
    // Автоматически сохраняем текущий рецепт перед созданием нового
    if (previousRecipeIdRef.current && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current)
    }
    
    // Очищаем все данные для нового рецепта
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
    setSavedNodes([]) // Устанавливаем пустой массив для очистки диаграммы
    setSavedEdges([]) // Устанавливаем пустой массив для очистки диаграммы
    setCurrentNodes([]) // Очищаем диаграмму (nodes)
    setCurrentEdges([]) // Очищаем диаграмму (edges)
    setCurrentRecipeId(undefined)
    setChatMessages(undefined) // Очищаем чат
    dispatch(setNutritionalInfo(null))
    previousRecipeIdRef.current = undefined
    
    // Закрываем сайдбар рецептов
    setIsRecipesSidebarOpen(false)
    
    antMessage.success('Новый рецепт создан')
  }, [currentNodes, currentEdges, autoSaveCurrentRecipe, dispatch])

  const handleSaveRecipe = (nodes: Node[], edges: Edge[], recipe?: string, message?: string) => {
    // Предотвращаем сохранение, если это уже загруженный рецепт
    if (currentRecipeId) {
      antMessage.warning('Этот рецепт уже сохранён. Изменения сохраняются автоматически.')
      return
    }

    try {
      const input = document.getElementById('recipe-name-input') as HTMLInputElement
      const name = input?.value.trim() || `Рецепт ${new Date().toLocaleDateString('ru-RU')}`
      
      // Преобразуем Date в timestamp для сохранения
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

      // Устанавливаем текущий ID рецепта
      setCurrentRecipeId(savedRecipe.id)
      previousRecipeIdRef.current = savedRecipe.id
      
      antMessage.success('Рецепт сохранён')
      setIsRecipesSidebarOpen(true)
      setRefreshRecipesTrigger((prev) => prev + 1)
    } catch (error) {
      antMessage.error('Не удалось сохранить рецепт')
      console.error('Error saving recipe:', error)
    }
  }

  const handleLoadRecipe = useCallback((savedRecipe: SavedRecipe) => {
    // Автоматически сохраняем предыдущий рецепт перед загрузкой нового
    if (previousRecipeIdRef.current && previousRecipeIdRef.current !== savedRecipe.id && (currentNodes.length > 0 || currentEdges.length > 0)) {
      autoSaveCurrentRecipe(previousRecipeIdRef.current)
    }

    // Отмечаем, что это начальная загрузка, чтобы не сохранять сразу
    isInitialLoadRef.current = true

    // Оптимизируем загрузку: выполняем все обновления синхронно, но используем батчинг React
    // Загружаем диаграмму напрямую
    setSavedNodes(savedRecipe.nodes)
    setSavedEdges(savedRecipe.edges)
    setCurrentNodes(savedRecipe.nodes)
    setCurrentEdges(savedRecipe.edges)
    setCurrentRecipeId(savedRecipe.id)
    previousRecipeIdRef.current = savedRecipe.id
    
    // Загружаем графики (nutritional info)
    dispatch(setNutritionalInfo(savedRecipe.nutritionalInfo || null))
    
    // Загружаем чат (преобразуем timestamp обратно в Date только если нужно)
    // Используем мемоизацию для оптимизации преобразования
    if (savedRecipe.chatMessages && savedRecipe.chatMessages.length > 0) {
      // Преобразуем только если timestamp - число, иначе используем как есть
      const messagesWithDates = savedRecipe.chatMessages.map((msg) => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : (msg.timestamp as Date),
      }))
      setChatMessages(messagesWithDates)
    } else {
      setChatMessages(undefined)
    }
    
    // Очищаем текущие рецепт и сообщение, чтобы не перезагружать flow
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
  }, [dispatch, autoSaveCurrentRecipe, currentNodes, currentEdges])

  const handleNavigate = (page: PageType) => {
    dispatch(setCurrentPage(page))
  }

  // Используем useRef для отслеживания предыдущих сообщений
  const previousChatMessagesRef = useRef<string>('')
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isInitialLoadRef = useRef<boolean>(false)
  
  // Мемоизируем callback для onMessagesChange, чтобы избежать бесконечных циклов
  const handleMessagesChange = useCallback((msgs: Array<{
    id: number
    text: string
    timestamp: Date
    isUser: boolean
    recipe?: any
  }>) => {
    // Проверяем, действительно ли сообщения изменились
    const newMessagesString = JSON.stringify(msgs)
    if (newMessagesString !== previousChatMessagesRef.current) {
      previousChatMessagesRef.current = newMessagesString
      setChatMessages(msgs)
    }
  }, [])
  
  // Обновляем ref при изменении chatMessages извне (например, при загрузке рецепта)
  useEffect(() => {
    if (chatMessages) {
      previousChatMessagesRef.current = JSON.stringify(chatMessages)
    } else {
      previousChatMessagesRef.current = ''
    }
  }, [chatMessages])

  // Автоматическое сохранение при изменении nodes/edges для текущего рецепта
  useEffect(() => {
    // Не сохраняем при первой загрузке
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // Сохраняем только если есть текущий рецепт и есть изменения
    if (currentRecipeId && (currentNodes.length > 0 || currentEdges.length > 0)) {
      // Используем debounce для избежания частых сохранений
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveCurrentRecipe(currentRecipeId)
      }, 2000) // Сохраняем через 2 секунды после последнего изменения

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

