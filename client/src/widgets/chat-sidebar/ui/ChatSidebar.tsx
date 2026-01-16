import { useState, useEffect, useRef, useCallback } from 'react'
import { Layout, Typography, Empty, Space, Spin, message as antMessage } from 'antd'
import { NodeIndexOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ToggleChatButton } from '@/features/toggle-chat/ui/ToggleChatButton'
import { Input } from '@/shared/ui/input/Input'
import { Button } from '@/shared/ui/button/Button'
import { chatApi } from '@/shared/api/chat/chat.api'
import { RecipeMessage } from '@/shared/ui/recipe-blocks/RecipeMessage'
import type { StructuredRecipe, RecipeBlock } from '@/shared/api/chat/types'
import styles from './chat-sidebar.module.scss'

const { Sider } = Layout
const { Title } = Typography

interface Message {
  id: number
  text: string
  timestamp: Date
  isUser: boolean
  recipe?: StructuredRecipe
}

interface ChatSidebarProps {
  onGenerateFlow?: (recipe?: StructuredRecipe) => void
  onGenerateDiagram?: (recipe?: string, message?: string) => void
  initialMessages?: Array<{
    id: number
    text: string
    timestamp: Date
    isUser: boolean
    recipe?: StructuredRecipe
  }>
  onMessagesChange?: (messages: Message[]) => void
}

const MIN_WIDTH = 520
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 600

export function ChatSidebar({ onGenerateFlow, onGenerateDiagram, initialMessages, onMessagesChange }: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages) {
      return initialMessages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      }))
    }
    return []
  })

  // Notify parent about message changes only on real changes
  const previousMessagesRef = useRef<string>(JSON.stringify(messages))
  
  useEffect(() => {
    const messagesString = JSON.stringify(messages)
    if (onMessagesChange && messagesString !== previousMessagesRef.current) {
      previousMessagesRef.current = messagesString
      onMessagesChange(messages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, onMessagesChange])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeStartXRef = useRef<number>(0)
  const resizeStartWidthRef = useRef<number>(DEFAULT_WIDTH)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Update messages when initialMessages changes (only if actually changed)
  const previousInitialMessagesRef = useRef<string>(JSON.stringify(initialMessages))
  
  useEffect(() => {
    const initialMessagesString = JSON.stringify(initialMessages)
    
    if (initialMessages && initialMessages.length > 0) {
      if (initialMessagesString !== previousInitialMessagesRef.current) {
        const mappedMessages = initialMessages.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
        }))
        setMessages(mappedMessages)
        previousInitialMessagesRef.current = initialMessagesString
        previousMessagesRef.current = JSON.stringify(mappedMessages)
      }
    } else if (!initialMessages && previousInitialMessagesRef.current !== 'null' && previousInitialMessagesRef.current !== '') {
      // If initialMessages became undefined, clear messages only if they were loaded before
      setMessages([])
      previousInitialMessagesRef.current = 'null'
      previousMessagesRef.current = '[]'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return
    
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  // Set up global mouse event listeners when resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartXRef.current - e.clientX // Inverted because sidebar is on the right
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidthRef.current + deltaX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Handle window resize for responsive behavior
  useEffect(() => {
    const constrainWidth = () => {
      const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.8) // Max 80% of viewport or MAX_WIDTH
      const minAllowedWidth = Math.max(MIN_WIDTH, window.innerWidth * 0.3) // Min 30% of viewport or MIN_WIDTH
      
      if (sidebarWidth > maxAllowedWidth) {
        setSidebarWidth(maxAllowedWidth)
      } else if (sidebarWidth < minAllowedWidth && window.innerWidth >= 768) {
        // Only enforce min width on desktop
        setSidebarWidth(minAllowedWidth)
      }
    }

    constrainWidth() // Check on mount
    window.addEventListener('resize', constrainWidth)
    return () => window.removeEventListener('resize', constrainWidth)
  }, [sidebarWidth])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now(),
      text: inputValue.trim(),
      timestamp: new Date(),
      isUser: true,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Create a placeholder bot message that will be updated as chunks/blocks arrive
    const botMessageId = Date.now() + 1
    const botMessage: Message = {
      id: botMessageId,
      text: '',
      timestamp: new Date(),
      isUser: false,
    }

    setMessages((prev) => [...prev, botMessage])

    // Accumulate blocks and message text as they arrive
    const accumulatedBlocks: RecipeBlock[] = []
    let accumulatedText = ''

    try {
      const history = messages.map((msg) => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text,
      }))

      // Use streaming API
      await chatApi.streamMessage(
        {
          message: userMessage.text,
          history,
        },
        (chunk: string) => {
          // Update the bot message with each chunk (for non-recipe responses)
          accumulatedText += chunk
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, text: accumulatedText }
                : msg,
            ),
          )
          // Scroll to bottom as new chunks arrive
          setTimeout(() => scrollToBottom(), 0)
        },
        (block: RecipeBlock) => {
          // Add block to accumulated blocks and update message in real-time
          accumulatedBlocks.push(block)
          const recipe: StructuredRecipe = {
            isRecipe: true,
            originalMessage: accumulatedText,
            blocks: [...accumulatedBlocks],
          }
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, recipe, text: accumulatedText || msg.text }
                : msg,
            ),
          )
          
          // Scroll to bottom as new blocks arrive
          setTimeout(() => scrollToBottom(), 0)
        },
        (recipe: StructuredRecipe) => {
          // Update the bot message with complete recipe data
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, recipe, text: accumulatedText || recipe.originalMessage || msg.text }
                : msg,
            ),
          )
          // Trigger flow generation only when recipe is completely received
          if (onGenerateFlow && recipe.isRecipe && recipe.blocks && recipe.blocks.length > 0) {
            onGenerateFlow(recipe)
          }
        },
        (error: Error) => {
          antMessage.error(error.message || 'Failed to stream message')
        },
      )
    } catch (error) {
      antMessage.error(error instanceof Error ? error.message : 'Failed to send message')
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id && msg.id !== botMessageId))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  // Handle generate diagram button click for specific recipe message
  const handleGenerateDiagram = useCallback((recipeMessage: Message) => {
    if (!recipeMessage.recipe) {
      antMessage.warning('No recipe found')
      return
    }

    // Extract recipe text from originalMessage or build from blocks
    const recipeText = recipeMessage.recipe.originalMessage || recipeMessage.text || ''
    
    if (!recipeText.trim()) {
      antMessage.warning('Recipe text is empty')
      return
    }

    // Call onGenerateDiagram if provided
    if (onGenerateDiagram) {
      onGenerateDiagram(recipeText, undefined)
    }
  }, [onGenerateDiagram])

  return (
    <>
      <Sider
        ref={sidebarRef}
        className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed} ${isResizing ? styles.resizing : ''}`}
        width={sidebarWidth}
        theme="light"
        style={{ width: sidebarWidth }}
      >
        {isOpen && (
          <div
            className={styles.resizeHandle}
            onMouseDown={handleResizeStart}
            aria-label="Resize sidebar"
          />
        )}
        <div className={styles.content}>
          <div className={styles.header}>
            <Title level={4} className={styles.title}>Chat</Title>
            <ToggleChatButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
          </div>
          
          <div className={styles.messages}>
            {messages.length === 0 && !isLoading ? (
              <Empty description="Chat is empty" />
            ) : (
              <>
                {messages.map((msg) => {
                  // Check if there are recipe blocks (even if isRecipe is false, but blocks exist)
                  const hasRecipeBlocks = !msg.isUser && msg.recipe && msg.recipe.blocks && msg.recipe.blocks.length > 0
                  const isRecipe = !msg.isUser && msg.recipe?.isRecipe
                  const shouldShowBlocks = hasRecipeBlocks || isRecipe
                  
                  // Don't render empty bot messages (they'll show the loading spinner instead)
                  if (!msg.isUser && !msg.text && !shouldShowBlocks) {
                    return null
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`${styles.message} ${msg.isUser ? styles.userMessage : styles.botMessage} ${shouldShowBlocks ? styles.recipeMessage : ''}`}
                    >
                      <div className={`${styles.messageBubble} ${shouldShowBlocks ? styles.recipeBubble : ''}`}>
                        {shouldShowBlocks && msg.recipe && msg.recipe.blocks ? (
                          <>
                          <RecipeMessage blocks={msg.recipe.blocks} />
                            <div className={styles.messageActions}>
                              <Button
                                type="primary"
                                icon={<NodeIndexOutlined />}
                                onClick={() => handleGenerateDiagram(msg)}
                                size="small"
                                title="Generate diagram from this recipe"
                              >
                                Generate Diagram
                              </Button>
                            </div>
                          </>
                        ) : (
                          msg.text && (
                            <div className={styles.messageText}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
                {isLoading && (
                  <div className={styles.loading}>
                    <Spin size="small" />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          
          <div className={styles.inputContainer}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
              />
              <Button onClick={handleSend} loading={isLoading} disabled={isLoading}>
                Send
              </Button>
            </Space.Compact>
          </div>
        </div>
      </Sider>
      {!isOpen && (
        <div className={styles.toggleButton}>
          <ToggleChatButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </div>
      )}
    </>
  )
}

