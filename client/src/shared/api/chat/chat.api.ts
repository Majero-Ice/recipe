import type { ChatRequest, ChatResponse, StructuredRecipe, RecipeBlock } from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const chatApi = {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to send message' }))
      throw new Error(error.message || 'Failed to send message')
    }

    return response.json()
  },

  /**
   * Streams chat response using Server-Sent Events (SSE)
   * @param request Chat request
   * @param onChunk Callback for each chunk received
   * @param onBlock Callback when a recipe block is received in real-time
   * @param onRecipe Callback when complete recipe data is received
   * @param onError Callback for errors
   * @returns Promise that resolves when streaming is complete, with the full message
   */
  async streamMessage(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onBlock?: (block: RecipeBlock) => void,
    onRecipe?: (recipe: StructuredRecipe) => void,
    onError?: (error: Error) => void,
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/chat/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to stream message' }))
      const err = new Error(error.message || 'Failed to stream message')
      onError?.(err)
      throw err
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullMessage = ''
    let buffer = ''

    if (!reader) {
      const err = new Error('Response body is not readable')
      onError?.(err)
      throw err
    }

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.chunk) {
                    fullMessage += data.chunk
                    onChunk(data.chunk)
                  }
                } catch (parseError) {
                  console.warn('Failed to parse SSE data:', line)
                }
              }
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.error) {
                const err = new Error(data.error)
                onError?.(err)
                throw err
              }

              if (data.done) {
                return fullMessage
              }

              if (data.block) {
                // Recipe block received in real-time
                onBlock?.(data.block)
              }

              if (data.recipe) {
                // Complete recipe structure received
                onRecipe?.(data.recipe)
              }

              if (data.chunk) {
                fullMessage += data.chunk
                onChunk(data.chunk)
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }

      return fullMessage
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during streaming')
      onError?.(err)
      throw err
    } finally {
      reader.releaseLock()
    }
  },
}








