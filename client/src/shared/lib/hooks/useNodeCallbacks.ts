import { useCallback, useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'

interface UseNodeCallbacksOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

export function useNodeCallbacks({ nodes, setNodes }: UseNodeCallbacksOptions) {
  const processedNodesRef = useRef<Set<string>>(new Set())

  const createNodeCallbacks = useCallback(
    (nodeId: string, nodeType?: string) => {
      return {
        onLabelChange: (newLabel: string) => {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
            )
          )
        },
        onDescriptionChange: (newDescription: string) => {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, description: newDescription } } : n
            )
          )
        },
        ...(nodeType === 'ingredientNode' && {
          onIngredientsChange: (ingredients: any[]) => {
            setNodes((prevNodes) =>
              prevNodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ingredients } } : n
              )
            )
          },
        }),
      }
    },
    [setNodes]
  )

  // Добавляем callbacks к nodes, которые их не имеют
  useEffect(() => {
    const nodesNeedingCallbacks = nodes.filter((node) => {
      const hasCallbacks =
        typeof node.data.onLabelChange === 'function' &&
        typeof node.data.onDescriptionChange === 'function' &&
        (node.type !== 'ingredientNode' || typeof node.data.onIngredientsChange === 'function')
      return !hasCallbacks
    })

    if (nodesNeedingCallbacks.length === 0) {
      const currentIds = new Set(nodes.map((n) => n.id))
      processedNodesRef.current = currentIds
      return
    }

    setNodes((nds) =>
      nds.map((node) => {
        const needsCallbacks =
          typeof node.data.onLabelChange !== 'function' ||
          typeof node.data.onDescriptionChange !== 'function' ||
          (node.type === 'ingredientNode' && typeof node.data.onIngredientsChange !== 'function')

        if (!needsCallbacks) {
          processedNodesRef.current.add(node.id)
          return node
        }

        processedNodesRef.current.add(node.id)
        return {
          ...node,
          data: {
            ...node.data,
            ...createNodeCallbacks(node.id, node.type),
          },
        }
      })
    )

    const currentIds = new Set(nodes.map((n) => n.id))
    processedNodesRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        processedNodesRef.current.delete(id)
      }
    })
  }, [nodes.length, setNodes, createNodeCallbacks, nodes])

  return {
    createNodeCallbacks,
    processedNodesRef,
  }
}


