import { useState } from 'react'
import { Layout } from 'antd'
import { FlowCanvas } from '@/widgets/flow-canvas/ui/FlowCanvas'
import { ChatSidebar } from '@/widgets/chat-sidebar/ui/ChatSidebar'
import { StatsPage } from '@/pages/stats-page'
import { PageNavigation } from '@/features/page-navigation'
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux/hooks'
import { setCurrentPage } from '@/entities/recipe/model/recipe.slice'
import type { PageType } from '@/entities/recipe/model/recipe.slice'
import styles from './main-page.module.scss'

const { Content } = Layout

export function MainPage() {
  const [flowRecipe, setFlowRecipe] = useState<string | undefined>()
  const [flowMessage, setFlowMessage] = useState<string | undefined>()
  const currentPage = useAppSelector((state) => state.recipe.currentPage)
  const dispatch = useAppDispatch()

  const handleGenerateFlow = (recipe?: string, message?: string) => {
    setFlowRecipe(recipe)
    setFlowMessage(message)
  }

  const handleNavigate = (page: PageType) => {
    dispatch(setCurrentPage(page))
  }

  return (
    <Layout className={styles.container}>
      <Content className={styles.content}>
        <div className={styles.pagesContainer}>
          <div
            className={`${styles.page} ${currentPage === 'flow' ? styles.active : styles.inactive} ${currentPage === 'stats' ? styles.slideLeft : ''}`}
          >
            <FlowCanvas recipe={flowRecipe} message={flowMessage} />
          </div>
          <div
            className={`${styles.page} ${currentPage === 'stats' ? styles.active : styles.inactive} ${currentPage === 'flow' ? styles.slideRight : ''}`}
          >
            <StatsPage />
          </div>
        </div>
        <PageNavigation onNavigate={handleNavigate} />
      </Content>
      <ChatSidebar onGenerateFlow={handleGenerateFlow} />
    </Layout>
  )
}

