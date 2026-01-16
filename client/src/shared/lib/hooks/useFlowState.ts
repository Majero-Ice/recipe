import { useState, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { StructuredRecipe } from '@/shared/api/chat/types'

export function useFlowState() {
  const [flowRecipe, setFlowRecipe] = useState<string | undefined>()
  const [flowMessage, setFlowMessage] = useState<string | undefined>()
  const [flowStructuredRecipe, setFlowStructuredRecipe] =
    useState<StructuredRecipe | undefined>()
  const [savedNodes, setSavedNodes] = useState<Node[] | undefined>()
  const [savedEdges, setSavedEdges] = useState<Edge[] | undefined>()
  const [currentNodes, setCurrentNodes] = useState<Node[]>([])
  const [currentEdges, setCurrentEdges] = useState<Edge[]>([])

  const resetFlow = useCallback(() => {
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
    setFlowStructuredRecipe(undefined)
    setSavedNodes(undefined)
    setSavedEdges(undefined)
  }, [])

  const resetFlowGeneration = useCallback(() => {
    // Сбрасывает только состояние генерации, но не savedNodes/savedEdges
    setFlowRecipe(undefined)
    setFlowMessage(undefined)
    setFlowStructuredRecipe(undefined)
  }, [])

  const setInitialNodesAndEdges = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      setSavedNodes(nodes)
      setSavedEdges(edges)
      setCurrentNodes(nodes)
      setCurrentEdges(edges)
    },
    []
  )

  const handleGenerateFlow = useCallback(
    (structuredRecipe?: StructuredRecipe) => {
      if (structuredRecipe && structuredRecipe.blocks && structuredRecipe.blocks.length > 0) {
        setFlowStructuredRecipe(structuredRecipe)
        const recipeText = structuredRecipe.blocks
          .map((block) => `## ${block.title}\n${block.content}`)
          .join('\n\n')
        setFlowRecipe(recipeText)
      } else {
        setFlowRecipe(undefined)
        setFlowStructuredRecipe(undefined)
      }
      setFlowMessage(undefined)
      setSavedNodes(undefined)
      setSavedEdges(undefined)
    },
    []
  )

  const handleGenerateDiagram = useCallback(
    (recipe?: string, message?: string) => {
      setFlowRecipe(recipe)
      setFlowMessage(message)
      setSavedNodes(undefined)
      setSavedEdges(undefined)
    },
    []
  )

  return {
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
    handleGenerateFlow,
    handleGenerateDiagram,
  }
}

