import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage } from '../utils/chatMessages'

export function useChatMessages(initialMessages?: ChatMessage[]) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[] | undefined>(
    initialMessages
  )
  const previousChatMessagesRef = useRef<string>('')

  const handleMessagesChange = useCallback((msgs: ChatMessage[]) => {
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

  return {
    chatMessages,
    setChatMessages,
    handleMessagesChange,
  }
}

