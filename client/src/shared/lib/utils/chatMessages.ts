export interface ChatMessage {
  id: number
  text: string
  timestamp: Date
  isUser: boolean
  recipe?: any
}

export interface SerializedChatMessage {
  id: number
  text: string
  timestamp: number
  isUser: boolean
  recipe?: any
}

/**
 * Преобразует сообщения чата в формат для сохранения (timestamp как number)
 */
export function serializeChatMessages(
  messages: ChatMessage[] | undefined
): SerializedChatMessage[] | undefined {
  if (!messages) return undefined

  return messages.map((msg) => ({
    ...msg,
    timestamp:
      msg.timestamp instanceof Date
        ? msg.timestamp.getTime()
        : typeof msg.timestamp === 'number'
          ? msg.timestamp
          : Date.now(),
  }))
}

/**
 * Преобразует сохраненные сообщения обратно в формат с Date
 */
export function deserializeChatMessages(
  messages: SerializedChatMessage[] | undefined
): ChatMessage[] | undefined {
  if (!messages) return undefined

  return messages.map((msg) => ({
    ...msg,
    timestamp:
      typeof msg.timestamp === 'number'
        ? new Date(msg.timestamp)
        : (msg.timestamp as Date),
  }))
}

