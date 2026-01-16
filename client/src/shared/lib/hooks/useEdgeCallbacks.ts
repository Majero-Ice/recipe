import { useCallback } from 'react'
import type { Edge } from '@xyflow/react'

interface UseEdgeCallbacksOptions {
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
}

export function useEdgeCallbacks({ setEdges }: UseEdgeCallbacksOptions) {
  const createEdgeCallbacks = useCallback(
    (edgeId: string) => {
      return {
        onTimeChange: (newTime: string) => {
          setEdges((prevEdges) =>
            prevEdges.map((e) =>
              e.id === edgeId ? { ...e, data: { ...e.data, time: newTime } } : e
            )
          )
        },
      }
    },
    [setEdges]
  )

  return {
    createEdgeCallbacks,
  }
}


