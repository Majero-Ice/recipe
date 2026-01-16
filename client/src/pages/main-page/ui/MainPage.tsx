import { useState, useCallback } from 'react'
import { Layout } from 'antd'
import { FlowCanvas } from '@/widgets/flow-canvas/ui/FlowCanvas'
import { ChatSidebar } from '@/widgets/chat-sidebar/ui/ChatSidebar'
import { RecipesSidebar } from '@/widgets/recipes-sidebar/ui/RecipesSidebar'
import { StatsPage } from '@/pages/stats-page'
import { PageNavigation } from '@/features/page-navigation'
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux/hooks'
import { setCurrentPage } from '@/entities/recipe/model/recipe.slice'
import type { PageType } from '@/entities/recipe/model/recipe.slice'
import type { SavedRecipe } from '@/shared/lib/localStorage/recipeStorage'
import type { StructuredRecipe } from '@/shared/api/chat/types'
import { useChatMessages } from '@/shared/lib/hooks/useChatMessages'
import { useFlowState } from '@/shared/lib/hooks/useFlowState'
import { useRecipeManagement } from '@/shared/lib/hooks/useRecipeManagement'
import styles from './main-page.module.scss'

const { Content } = Layout

export function MainPage() {
  const [isRecipesSidebarOpen, setIsRecipesSidebarOpen] = useState(false)
  const currentPage = useAppSelector((state) => state.recipe.currentPage)
  const dispatch = useAppDispatch()

  // Управление состоянием flow
  const {
    flowRecipe,
    flowMessage,
    flowStructuredRecipe,
    savedNodes,
    savedEdges,
    currentNodes,
    currentEdges,
    setCurrentNodes,
    setCurrentEdges,
    resetFlow,
    resetFlowGeneration,
    setInitialNodesAndEdges,
    handleGenerateFlow: flowStateHandleGenerateFlow,
    handleGenerateDiagram: flowStateHandleGenerateDiagram,
  } = useFlowState()

  // Управление сообщениями чата
  const { chatMessages, setChatMessages, handleMessagesChange } = useChatMessages()

  // Мемоизированные колбэки для useRecipeManagement
  const handleRecipeChange = useCallback(
    (recipeId: string | undefined) => {
      if (recipeId) {
        setIsRecipesSidebarOpen(true)
      }
    },
    []
  )

  const handleInitialLoad = useCallback(
    (data: { nodes: any[]; edges: any[]; chatMessages?: any[] }) => {
      setInitialNodesAndEdges(data.nodes, data.edges)
      if (data.chatMessages) {
        setChatMessages(data.chatMessages)
      }
    },
    [setInitialNodesAndEdges, setChatMessages]
  )

  // Управление рецептами
  const {
    currentRecipeId,
    refreshRecipesTrigger,
    handleSaveRecipe,
    handleDeleteRecipe,
    handleLoadRecipe: recipeManagementHandleLoadRecipe,
    handleNewRecipe: recipeManagementHandleNewRecipe,
    autoSaveCurrentRecipe,
  } = useRecipeManagement({
    currentNodes,
    currentEdges,
    chatMessages,
    onRecipeChange: handleRecipeChange,
    onInitialLoad: handleInitialLoad,
  })

  // Обработчики для генерации flow и диаграммы с автосохранением
  const handleGenerateFlow = useCallback(
    (structuredRecipe?: StructuredRecipe) => {
      if (currentRecipeId && (currentNodes.length > 0 || currentEdges.length > 0 || chatMessages)) {
        autoSaveCurrentRecipe(currentRecipeId, currentNodes, currentEdges)
      }

      flowStateHandleGenerateFlow(structuredRecipe)

      if (!currentRecipeId) {
        setChatMessages(undefined)
      }
    },
    [currentRecipeId, currentNodes, currentEdges, chatMessages, autoSaveCurrentRecipe, flowStateHandleGenerateFlow]
  )

  const handleGenerateDiagram = useCallback(
    (recipe?: string, message?: string) => {
      if (currentRecipeId && (currentNodes.length > 0 || currentEdges.length > 0 || chatMessages)) {
        autoSaveCurrentRecipe(currentRecipeId, currentNodes, currentEdges)
      }

      flowStateHandleGenerateDiagram(recipe, message)
    },
    [currentRecipeId, currentNodes, currentEdges, chatMessages, autoSaveCurrentRecipe, flowStateHandleGenerateDiagram]
  )

  // Обработчик создания нового рецепта
  const handleNewRecipe = useCallback(() => {
    recipeManagementHandleNewRecipe()
    resetFlow()
    setCurrentNodes([])
    setCurrentEdges([])
    setChatMessages(undefined)
    setIsRecipesSidebarOpen(false)
  }, [recipeManagementHandleNewRecipe, resetFlow])

  // Обработчик загрузки рецепта
  const handleLoadRecipe = useCallback(
    (savedRecipe: SavedRecipe) => {
      const loadedData = recipeManagementHandleLoadRecipe(savedRecipe)
      if (loadedData) {
        setInitialNodesAndEdges(loadedData.nodes, loadedData.edges)
        if (loadedData.chatMessages) {
          setChatMessages(loadedData.chatMessages)
        }
      }
      // Сбрасываем только состояние генерации flow, но не savedNodes/savedEdges
      // так как они уже установлены через setInitialNodesAndEdges
      resetFlowGeneration()
    },
    [recipeManagementHandleLoadRecipe, setInitialNodesAndEdges, resetFlowGeneration]
  )

  // Обработчик удаления рецепта
  const handleDeleteRecipeWithReset = useCallback(() => {
    handleDeleteRecipe()
    resetFlow()
    setCurrentNodes([])
    setCurrentEdges([])
    setChatMessages(undefined)
  }, [handleDeleteRecipe, resetFlow])

  // Обработчик навигации
  const handleNavigate = useCallback(
    (page: PageType) => {
      dispatch(setCurrentPage(page))
    },
    [dispatch]
  )

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
              onDelete={handleDeleteRecipeWithReset}
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

