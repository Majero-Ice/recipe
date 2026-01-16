import type { RecipeFlowRequest, RecipeFlowResponse, FlowNode, FlowEdge } from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const recipeFlowApi = {
  async generateFlow(request: RecipeFlowRequest): Promise<RecipeFlowResponse> {
    const response = await fetch(`${API_BASE_URL}/recipe-flow/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to generate flow' }))
      throw new Error(error.message || 'Failed to generate flow')
    }

    return response.json()
  },

  /**
   * Streams flow diagram generation using Server-Sent Events (SSE)
   * @param request Flow request
   * @param onTitle Callback when recipe title is received
   * @param onNode Callback when a node is received in real-time
   * @param onEdge Callback when an edge is received in real-time
   * @param onComplete Callback when complete flow data is received
   * @param onError Callback for errors
   * @returns Promise that resolves when streaming is complete
   */
  async streamFlow(
    request: RecipeFlowRequest,
    onNode?: (node: FlowNode) => void,
    onEdge?: (edge: FlowEdge) => void,
    onComplete?: (data: RecipeFlowResponse) => void,
    onError?: (error: Error) => void,
    onTitle?: (title: string) => void,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/recipe-flow/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to stream flow' }))
      const err = new Error(error.message || 'Failed to stream flow')
      onError?.(err)
      throw err
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
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
                  if (data.title) onTitle?.(data.title)
                  if (data.node) onNode?.(data.node)
                  if (data.edge) onEdge?.(data.edge)
                  if (data.complete) onComplete?.(data.complete)
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
                return
              }

              if (data.node) {
                onNode?.(data.node)
              }

              if (data.edge) {
                onEdge?.(data.edge)
              }

              if (data.title) {
                onTitle?.(data.title)
              }

              if (data.complete) {
                onComplete?.(data.complete)
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during streaming')
      onError?.(err)
      throw err
    } finally {
      reader.releaseLock()
    }
  },
}




