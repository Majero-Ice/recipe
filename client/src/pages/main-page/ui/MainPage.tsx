import { useState } from 'react'
import { Layout } from 'antd'
import { FlowCanvas } from '@/widgets/flow-canvas/ui/FlowCanvas'
import { ChatSidebar } from '@/widgets/chat-sidebar/ui/ChatSidebar'
import styles from './main-page.module.scss'

const { Content } = Layout

export function MainPage() {
  const [flowRecipe, setFlowRecipe] = useState<string | undefined>()
  const [flowMessage, setFlowMessage] = useState<string | undefined>()

  const handleGenerateFlow = (recipe?: string, message?: string) => {
    setFlowRecipe(recipe)
    setFlowMessage(message)
  }

  return (
    <Layout className={styles.container}>
      <Content className={styles.content}>
        <FlowCanvas recipe={flowRecipe} message={flowMessage} />
      </Content>
      <ChatSidebar onGenerateFlow={handleGenerateFlow} />
    </Layout>
  )
}

