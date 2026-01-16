import { useState, useCallback, useRef } from 'react'
import { useAppDispatch } from '../redux/hooks'
import { setNutritionalInfo } from '@/entities/recipe/model/recipe.slice'
import { recipeFlowApi } from '@/shared/api/recipe-flow/recipe-flow.api'
import type { FlowNode, FlowEdge, RecipeFlowResponse } from '@/shared/api/recipe-flow/types'
import type { StructuredRecipe } from '@/shared/api/chat/types'
import type { Node, Edge } from '@xyflow/react'
import { message as antMessage } from 'antd'
import { autoLayoutNodes, getOptimalHandles } from '../utils/flowLayout'

const nodeTypes = {
  ingredientNode: 'ingredientNode',
  preparationNode: 'preparationNode',
  cookingNode: 'cookingNode',
  servingNode: 'servingNode',
  blockNode: 'blockNode',
} as const

interface UseFlowDataLoaderOptions {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  reactFlowInstanceRef: React.RefObject<any>
}

export function useFlowDataLoader({
  setNodes,
  setEdges,
  containerRef,
  reactFlowInstanceRef,
}: UseFlowDataLoaderOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [recipeTitle, setRecipeTitle] = useState<string | undefined>(undefined)
  const dispatch = useAppDispatch()

  const loadFlowData = useCallback(
    async (
      recipeText?: string,
      messageText?: string,
      structuredRecipeData?: StructuredRecipe
    ) => {
      if (structuredRecipeData && structuredRecipeData.blocks && structuredRecipeData.blocks.length > 0) {
        recipeText = structuredRecipeData.blocks
          .map((block) => `## ${block.title}\n${block.content}`)
          .join('\n\n')
        messageText = undefined
      }

      if (!recipeText && !messageText) return

      setIsStreaming(true)
      setRecipeTitle(undefined)

      setNodes([])
      setEdges([])

      const accumulatedNodes = new Map<string, Node>()
      const accumulatedEdges = new Map<string, Edge>()

      const updateNodesAndEdges = (nodes: Node[], edges: Edge[]) => {
        const containerWidth = containerRef.current?.clientWidth
        const positionedNodes = autoLayoutNodes(nodes, edges, containerWidth)

        const usedSourceHandles = new Set<string>()
        const usedTargetHandles = new Set<string>()

        const edgesWithHandles = edges.map((edge) => {
          const sourceNode = positionedNodes.find((n) => n.id === edge.source)
          const targetNode = positionedNodes.find((n) => n.id === edge.target)

          if (sourceNode && targetNode) {
            const handles = getOptimalHandles(sourceNode, targetNode, usedSourceHandles, usedTargetHandles)

            const sourceHandleKey = `${sourceNode.id}:${handles.sourceHandle}`
            const targetHandleKey = `${targetNode.id}:${handles.targetHandle}`
            usedSourceHandles.add(sourceHandleKey)
            usedTargetHandles.add(targetHandleKey)

            return {
              ...edge,
              sourceHandle: handles.sourceHandle,
              targetHandle: handles.targetHandle,
            }
          }
          return edge
        })

        setNodes(positionedNodes)
        setEdges(edgesWithHandles)

        setTimeout(() => {
          if (reactFlowInstanceRef.current) {
            reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 200 })
          }
        }, 50)
      }

      try {
        await recipeFlowApi.streamFlow(
          {
            recipe: recipeText,
            message: messageText,
            structuredRecipe: structuredRecipeData,
          },
          (node: FlowNode) => {
            const nodeType =
              node.type && nodeTypes[node.type as keyof typeof nodeTypes]
                ? node.type
                : 'blockNode'

            const reactFlowNode: Node = {
              id: node.id,
              type: nodeType,
              position: { x: 0, y: 0 },
              data: node.data,
            }

            accumulatedNodes.set(node.id, reactFlowNode)

            const currentNodes = Array.from(accumulatedNodes.values())
            const currentEdges = Array.from(accumulatedEdges.values())
            updateNodesAndEdges(currentNodes, currentEdges)
          },
          (edge: FlowEdge) => {
            const hasTime = edge.time && edge.time.trim().length > 0

            const reactFlowEdge: Edge = {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              type: hasTime ? 'timeEdge' : undefined,
              data: hasTime
                ? {
                    time: edge.time,
                    label: edge.label,
                  }
                : {
                    label: edge.label,
                  },
            }

            accumulatedEdges.set(edge.id, reactFlowEdge)

            const currentNodes = Array.from(accumulatedNodes.values())
            const currentEdges = Array.from(accumulatedEdges.values())
            updateNodesAndEdges(currentNodes, currentEdges)
          },
          (response: RecipeFlowResponse) => {
            if (response.title) {
              setRecipeTitle(response.title)
            }

            const flowNodes: Node[] = response.nodes.map((node: FlowNode) => {
              const nodeType =
                node.type && nodeTypes[node.type as keyof typeof nodeTypes]
                  ? node.type
                  : 'blockNode'

              return {
                id: node.id,
                type: nodeType,
                position: { x: 0, y: 0 },
                data: node.data,
              }
            })

            const flowEdges: Edge[] = response.edges.map((edge: FlowEdge) => {
              const hasTime = edge.time && edge.time.trim().length > 0

              return {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: hasTime ? 'timeEdge' : undefined,
                data: hasTime
                  ? {
                      time: edge.time,
                      label: edge.label,
                    }
                  : {
                      label: edge.label,
                    },
              }
            })

            const containerWidth = containerRef.current?.clientWidth
            const positionedNodes = autoLayoutNodes(flowNodes, flowEdges, containerWidth)

            const usedSourceHandles = new Set<string>()
            const usedTargetHandles = new Set<string>()

            const edgesWithHandles = flowEdges.map((edge) => {
              const sourceNode = positionedNodes.find((n) => n.id === edge.source)
              const targetNode = positionedNodes.find((n) => n.id === edge.target)

              if (sourceNode && targetNode) {
                const handles = getOptimalHandles(sourceNode, targetNode, usedSourceHandles, usedTargetHandles)

                const sourceHandleKey = `${sourceNode.id}:${handles.sourceHandle}`
                const targetHandleKey = `${targetNode.id}:${handles.targetHandle}`
                usedSourceHandles.add(sourceHandleKey)
                usedTargetHandles.add(targetHandleKey)

                return {
                  ...edge,
                  sourceHandle: handles.sourceHandle,
                  targetHandle: handles.targetHandle,
                }
              }
              return edge
            })

            setNodes(positionedNodes)
            setEdges(edgesWithHandles)

            setTimeout(() => {
              if (reactFlowInstanceRef.current) {
                reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 400 })
              }
            }, 300)

            setIsStreaming(false)

            if (response.nutritionalInfo) {
              dispatch(setNutritionalInfo(response.nutritionalInfo))
            } else {
              dispatch(setNutritionalInfo(null))
            }
          },
          (error: Error) => {
            antMessage.error(error.message || 'Failed to generate flow diagram')
            console.error('Error streaming flow data:', error)
            setIsStreaming(false)
          },
          (title: string) => {
            setRecipeTitle(title)
          }
        )
      } catch (error) {
        antMessage.error(error instanceof Error ? error.message : 'Failed to load flow diagram')
        console.error('Error loading flow data:', error)
        setIsStreaming(false)
      }
    },
    [setNodes, setEdges, containerRef, reactFlowInstanceRef, dispatch]
  )

  return {
    isStreaming,
    recipeTitle,
    loadFlowData,
  }
}

