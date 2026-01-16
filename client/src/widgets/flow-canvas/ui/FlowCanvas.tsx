import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Node, Edge, Connection, ReactFlowInstance, OnNodesDelete, OnEdgesDelete } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { IngredientNode } from '@/shared/ui/nodes/ingredientNode/IngredientNode'
import { PreparationNode } from '@/shared/ui/nodes/preparationNode/PreparationNode'
import { CookingNode } from '@/shared/ui/nodes/cookingNode/CookingNode'
import { ServingNode } from '@/shared/ui/nodes/servingNode/ServingNode'
import { BlockNode } from '@/shared/ui/nodes/blockNode/BlockNode'
import { TimeEdge } from '@/shared/ui/edges/TimeEdge'
import { ContextMenu } from './ContextMenu'
import { EdgeContextMenu } from './EdgeContextMenu'
import { recipeFlowApi } from '@/shared/api/recipe-flow/recipe-flow.api'
import type { FlowNode, FlowEdge, RecipeFlowResponse } from '@/shared/api/recipe-flow/types'
import { message as antMessage, Modal, Spin } from 'antd'
import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux/hooks'
import { setNutritionalInfo } from '@/entities/recipe/model/recipe.slice'
import { Button } from '@/shared/ui/button/Button'
import styles from './flow-canvas.module.scss'

const NODE_WIDTH = 220
const NODE_SPACING_X = 280
const NODE_SPACING_Y = 250
const START_X = 100
const START_Y = 150
const MIN_PADDING = 50

function getAlternativeHandles(preferredSourceHandle: string, preferredTargetHandle: string): Array<{ sourceHandle: string; targetHandle: string }> {
  const alternatives: Array<{ sourceHandle: string; targetHandle: string }> = []
  
  const sourceDir = preferredSourceHandle.replace('source-', '')
  const targetDir = preferredTargetHandle.replace('target-', '')
  
  alternatives.push({ sourceHandle: preferredSourceHandle, targetHandle: preferredTargetHandle })
  
  if (sourceDir === 'right' || sourceDir === 'left') {
    const oppositeSource = sourceDir === 'right' ? 'source-left' : 'source-right'
    const oppositeTarget = targetDir === 'left' ? 'target-right' : 'target-left'
    alternatives.push({ sourceHandle: oppositeSource, targetHandle: oppositeTarget })
  }
  
  if (sourceDir === 'top' || sourceDir === 'bottom') {
    const oppositeSource = sourceDir === 'top' ? 'source-bottom' : 'source-top'
    const oppositeTarget = targetDir === 'bottom' ? 'target-top' : 'target-bottom'
    alternatives.push({ sourceHandle: oppositeSource, targetHandle: oppositeTarget })
  }
  
  if (sourceDir === 'right' || sourceDir === 'left') {
    alternatives.push({ sourceHandle: 'source-bottom', targetHandle: 'target-top' })
    alternatives.push({ sourceHandle: 'source-top', targetHandle: 'target-bottom' })
  } else {
    alternatives.push({ sourceHandle: 'source-right', targetHandle: 'target-left' })
    alternatives.push({ sourceHandle: 'source-left', targetHandle: 'target-right' })
  }
  
  return alternatives
}

function getOptimalHandles(
  sourceNode: Node,
  targetNode: Node,
  usedSourceHandles: Set<string>,
  usedTargetHandles: Set<string>,
): { sourceHandle: string; targetHandle: string } {
  const sourceHandle = 'source'
  const targetHandle = 'target'
  
  return { sourceHandle, targetHandle }
}

function calculateNodesPerRow(containerWidth?: number): number {
  if (typeof window === 'undefined') return 4
  
  let availableWidth: number
  
  if (containerWidth) {
    availableWidth = containerWidth
  } else {
    const estimatedSidebarWidth = 320
    const viewportWidth = window.innerWidth
    
    availableWidth = viewportWidth - estimatedSidebarWidth
  }
  
  const usableWidth = availableWidth - (MIN_PADDING * 2)
  
  const nodesPerRow = Math.floor((usableWidth - NODE_WIDTH + NODE_SPACING_X) / NODE_SPACING_X)
  
  return Math.max(1, nodesPerRow)
}

function autoLayoutNodes(nodes: Node[], edges: Edge[], containerWidth?: number): Node[] {
  if (nodes.length === 0) return nodes

  const children = new Map<string, string[]>()
  const parents = new Map<string, Set<string>>()
  const nodeMap = new Map<string, Node>()
  
  nodes.forEach((node) => {
    children.set(node.id, [])
    parents.set(node.id, new Set())
    nodeMap.set(node.id, node)
  })

  edges.forEach((edge) => {
    children.get(edge.source)?.push(edge.target)
    parents.get(edge.target)?.add(edge.source)
  })

  const ingredientNode = nodes.find(n => n.type === 'ingredientNode')
  if (!ingredientNode) {
    return simpleLayout(nodes, containerWidth)
  }

  const blockNodes = children.get(ingredientNode.id)?.map(id => nodeMap.get(id)!).filter(n => n?.type === 'blockNode') || []
  
  if (blockNodes.length === 0) {
    return simpleLayout(nodes, containerWidth)
  }

  const positionedNodes: Node[] = []
  const positioned = new Set<string>()

  const blockChains: Array<{ blockNode: Node; chain: Node[]; mergeNodeId?: string }> = []
  const allVisitedInBlocks = new Set<string>()
  
  blockNodes.forEach((blockNode) => {
    const chain: Node[] = [blockNode]
    const blockVisited = new Set<string>([blockNode.id])
    allVisitedInBlocks.add(blockNode.id)
    
    let currentNode = blockNode
    let mergeNodeId: string | undefined = undefined
    
    while (true) {
      const nextNodes = children.get(currentNode.id)?.filter(id => !blockVisited.has(id)) || []
      if (nextNodes.length === 0) break
      
      const nextId = nextNodes[0]
      const nextNode = nodeMap.get(nextId)!
      
      const nodeParents = parents.get(nextId) || new Set()
      if (nodeParents.size > 1) {
        mergeNodeId = nextId
        allVisitedInBlocks.add(nextId)
        break
      }
      
      const hasMergeChild = nextNodes.some(id => {
        const childParents = parents.get(id) || new Set()
        return childParents.size > 1
      })
      
      if (hasMergeChild && nextNodes.length > 1) {
        const mergeChild = nextNodes.find(id => {
          const childParents = parents.get(id) || new Set()
          return childParents.size > 1
        })
        if (mergeChild) {
          mergeNodeId = mergeChild
          allVisitedInBlocks.add(mergeChild)
          break
        }
      }
      
      chain.push(nextNode)
      blockVisited.add(nextId)
      allVisitedInBlocks.add(nextId)
      currentNode = nextNode
    }
    
    blockChains.push({ blockNode, chain, mergeNodeId })
  })

  const centerX = containerWidth ? containerWidth / 2 - NODE_WIDTH / 2 : 400
  const leftX = START_X
  
  const blockStartX = centerX - 200
  let maxBlockX = blockStartX
  
  blockChains.forEach(({ chain, mergeNodeId }, blockIndex) => {
    const blockY = START_Y + blockIndex * NODE_SPACING_Y
    
    chain.forEach((node, nodeIndex) => {
      if (positioned.has(node.id)) return
      
      const nodeX = blockStartX + nodeIndex * NODE_SPACING_X
      maxBlockX = Math.max(maxBlockX, nodeX + NODE_WIDTH)
      
      positionedNodes.push({
        ...node,
        position: {
          x: Math.round(nodeX),
          y: Math.round(blockY),
        },
      })
      positioned.add(node.id)
    })
  })
  
  let rightX: number
  if (containerWidth) {
    rightX = containerWidth - NODE_WIDTH - START_X
  } else {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const estimatedSidebarWidth = 320
    const availableWidth = viewportWidth - estimatedSidebarWidth
    rightX = availableWidth - NODE_WIDTH - START_X
  }
  
  const minRightX = maxBlockX + NODE_SPACING_X
  rightX = Math.max(rightX, minRightX)

  const firstBlockY = START_Y
  const lastBlockY = START_Y + (blockChains.length - 1) * NODE_SPACING_Y
  const middleY = (firstBlockY + lastBlockY) / 2

  positionedNodes.push({
    ...ingredientNode,
    position: { x: Math.round(leftX), y: Math.round(middleY) },
  })
  positioned.add(ingredientNode.id)

  const allMergeNodes = new Set<string>()
  blockChains.forEach(({ mergeNodeId }) => {
    if (mergeNodeId) allMergeNodes.add(mergeNodeId)
  })

  allMergeNodes.forEach(mergeNodeId => {
    if (positioned.has(mergeNodeId)) return
    
    const mergeNode = nodeMap.get(mergeNodeId)!
    positionedNodes.push({
      ...mergeNode,
      position: {
        x: Math.round(rightX),
        y: Math.round(middleY),
      },
    })
    positioned.add(mergeNodeId)
  })

  const nodesAfterMerge: Node[] = []
  const visitedAfterMerge = new Set<string>()
  
  const findNodesAfter = (nodeId: string, depth: number = 0) => {
    if (depth > 20) return
    
    const childrenIds = children.get(nodeId) || []
    childrenIds.forEach(childId => {
      if (visitedAfterMerge.has(childId)) return
      visitedAfterMerge.add(childId)
      
      const child = nodeMap.get(childId)!
      if (!positioned.has(childId)) {
        nodesAfterMerge.push(child)
        findNodesAfter(childId, depth + 1)
      }
    })
  }

  allMergeNodes.forEach(mergeNodeId => {
    findNodesAfter(mergeNodeId)
  })

  const nodesPerRow = calculateNodesPerRow(containerWidth)
  const mergeStartY = lastBlockY + NODE_SPACING_Y
  
  nodesAfterMerge.forEach((node, index) => {
    if (positioned.has(node.id)) return
    
    const rowIndex = Math.floor(index / nodesPerRow)
    const colIndex = index % nodesPerRow
    
    const rowStartX = rightX
    const nodeX = rowStartX - colIndex * NODE_SPACING_X
    const nodeY = mergeStartY + rowIndex * NODE_SPACING_Y
    
    positionedNodes.push({
      ...node,
      position: {
        x: Math.round(nodeX),
        y: Math.round(nodeY),
      },
    })
    positioned.add(node.id)
  })

  nodes.forEach(node => {
    if (!positioned.has(node.id)) {
      positionedNodes.push({
        ...node,
        position: {
          x: Math.round(centerX),
          y: Math.round(START_Y + positionedNodes.length * NODE_SPACING_Y),
        },
      })
    }
  })

  return positionedNodes
}

function simpleLayout(nodes: Node[], containerWidth?: number): Node[] {
  const nodesPerRow = calculateNodesPerRow(containerWidth)
  const positionedNodes: Node[] = []
  const centerX = containerWidth ? containerWidth / 2 - NODE_WIDTH / 2 : 400

  for (let i = 0; i < nodes.length; i += nodesPerRow) {
    const rowNodes = nodes.slice(i, i + nodesPerRow)
    const rowIndex = Math.floor(i / nodesPerRow)
    const isEvenRow = rowIndex % 2 === 0

    rowNodes.forEach((node, colIndex) => {
      let x: number
      if (isEvenRow) {
        x = centerX - ((rowNodes.length - 1) * NODE_SPACING_X) / 2 + colIndex * NODE_SPACING_X
      } else {
        const rowWidth = (rowNodes.length - 1) * NODE_SPACING_X
        x = centerX + rowWidth / 2 - (colIndex * NODE_SPACING_X)
      }

      positionedNodes.push({
        ...node,
        position: {
          x: Math.round(x),
          y: Math.round(START_Y + rowIndex * NODE_SPACING_Y),
        },
      })
    })
  }

  return positionedNodes
}

const nodeTypes = {
  ingredientNode: IngredientNode,
  preparationNode: PreparationNode,
  cookingNode: CookingNode,
  servingNode: ServingNode,
  blockNode: BlockNode,
}

const edgeTypes = {
  timeEdge: TimeEdge,
}

const initialNodes: Node[] = []

const initialEdges: Edge[] = []

interface FlowCanvasProps {
  recipe?: string
  message?: string
  structuredRecipe?: import('@/shared/api/chat/types').StructuredRecipe
  onSave?: (nodes: Node[], edges: Edge[], recipe?: string, message?: string, title?: string) => void
  onDelete?: () => void
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
  isSavedRecipe?: boolean
}

export function FlowCanvas({ 
  recipe, 
  message,
  structuredRecipe,
  onSave,
  onDelete,
  initialNodes, 
  initialEdges, 
  onNodesChange: externalOnNodesChange,
  onEdgesChange: externalOnEdgesChange,
  isSavedRecipe = false 
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || [])
  
  const previousNodesRef = useRef<Node[]>([])
  const previousEdgesRef = useRef<Edge[]>([])
  const previousNodesLengthRef = useRef<number>(0)
  const previousEdgesLengthRef = useRef<number>(0)
  const nodesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const edgesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (nodesChangeTimeoutRef.current) {
      clearTimeout(nodesChangeTimeoutRef.current)
    }
    
    nodesChangeTimeoutRef.current = setTimeout(() => {
      const nodesChanged = nodes.length !== previousNodesLengthRef.current || 
        JSON.stringify(nodes.map(n => ({ id: n.id, data: n.data, position: n.position }))) !== 
        JSON.stringify(previousNodesRef.current?.map(n => ({ id: n.id, data: n.data, position: n.position })))
      
      if (nodesChanged && externalOnNodesChange) {
        externalOnNodesChange(nodes)
        previousNodesLengthRef.current = nodes.length
        previousNodesRef.current = nodes
      }
    }, 100)

    return () => {
      if (nodesChangeTimeoutRef.current) {
        clearTimeout(nodesChangeTimeoutRef.current)
      }
    }
  }, [nodes, externalOnNodesChange])

  useEffect(() => {
    if (edgesChangeTimeoutRef.current) {
      clearTimeout(edgesChangeTimeoutRef.current)
    }
    
    edgesChangeTimeoutRef.current = setTimeout(() => {
      const edgesChanged = edges.length !== previousEdgesLengthRef.current ||
        JSON.stringify(edges.map(e => ({ id: e.id, source: e.source, target: e.target }))) !==
        JSON.stringify(previousEdgesRef.current?.map(e => ({ id: e.id, source: e.source, target: e.target })))
      
      if (edgesChanged && externalOnEdgesChange) {
        externalOnEdgesChange(edges)
        previousEdgesLengthRef.current = edges.length
        previousEdgesRef.current = edges
      }
    }, 100)

    return () => {
      if (edgesChangeTimeoutRef.current) {
        clearTimeout(edgesChangeTimeoutRef.current)
      }
    }
  }, [edges, externalOnEdgesChange])
  const [isStreaming, setIsStreaming] = useState(false)
  const [recipeTitle, setRecipeTitle] = useState<string | undefined>(undefined)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isCreatingEdge, setIsCreatingEdge] = useState(false)
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dispatch = useAppDispatch()
  const nutritionalInfo = useAppSelector((state) => state.recipe.nutritionalInfo)
  const previousInitialNodesRef = useRef<Node[] | undefined>(undefined)
  const previousInitialEdgesRef = useRef<Edge[] | undefined>(undefined)
  
  const initialNodesKey = useMemo(() => {
    if (!initialNodes || initialNodes.length === 0) return ''
    return `${initialNodes.length}-${initialNodes[0]?.id || ''}`
  }, [initialNodes])
  
  const initialEdgesKey = useMemo(() => {
    if (!initialEdges || initialEdges.length === 0) return ''
    return `${initialEdges.length}-${initialEdges[0]?.id || ''}`
  }, [initialEdges])

  const loadFlowData = useCallback(async (recipeText?: string, messageText?: string, structuredRecipeData?: import('@/shared/api/chat/types').StructuredRecipe) => {
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

    try {
      await recipeFlowApi.streamFlow(
        {
          recipe: recipeText,
          message: messageText,
          structuredRecipe: structuredRecipeData,
        },
            (node: FlowNode) => {
              const nodeType = node.type && nodeTypes[node.type as keyof typeof nodeTypes] 
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
              const containerWidth = containerRef.current?.clientWidth
              const positionedNodes = autoLayoutNodes(currentNodes, currentEdges, containerWidth)
              
              const usedSourceHandles = new Set<string>()
              const usedTargetHandles = new Set<string>()
              
              const updatedEdges = currentEdges.map((edge) => {
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
              setEdges(updatedEdges)
              
              setTimeout(() => {
                if (reactFlowInstanceRef.current) {
                  reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 200 })
                }
              }, 50)
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
          const containerWidth = containerRef.current?.clientWidth
          const positionedNodes = autoLayoutNodes(currentNodes, currentEdges, containerWidth)
          
          const usedSourceHandles = new Set<string>()
          const usedTargetHandles = new Set<string>()
          
          const updatedEdges = currentEdges.map((e) => {
            const srcNode = positionedNodes.find((n) => n.id === e.source)
            const tgtNode = positionedNodes.find((n) => n.id === e.target)
            
            if (srcNode && tgtNode) {
              const handles = getOptimalHandles(srcNode, tgtNode, usedSourceHandles, usedTargetHandles)
              
              const sourceHandleKey = `${srcNode.id}:${handles.sourceHandle}`
              const targetHandleKey = `${tgtNode.id}:${handles.targetHandle}`
              usedSourceHandles.add(sourceHandleKey)
              usedTargetHandles.add(targetHandleKey)
              
              return {
                ...e,
                sourceHandle: handles.sourceHandle,
                targetHandle: handles.targetHandle,
              }
            }
            return e
          })
          
          setNodes(positionedNodes)
          setEdges(updatedEdges)
          
          setTimeout(() => {
            if (reactFlowInstanceRef.current) {
              reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 200 })
            }
          }, 100)
        },
        (response: RecipeFlowResponse) => {
          if (response.title) {
            setRecipeTitle(response.title)
          }
          
          const flowNodes: Node[] = response.nodes.map((node: FlowNode) => {
            const nodeType = node.type && nodeTypes[node.type as keyof typeof nodeTypes] 
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
        },
      )
    } catch (error) {
      antMessage.error(error instanceof Error ? error.message : 'Failed to load flow diagram')
      console.error('Error loading flow data:', error)
      setIsStreaming(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    if (initialNodes === undefined) {
      previousInitialNodesRef.current = undefined
      previousInitialEdgesRef.current = undefined
      return
    }

    if (initialNodes.length === 0) {
      setNodes([])
      setEdges([])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
      return
    }

    const nodesChanged = previousInitialNodesRef.current !== initialNodes || 
                        initialNodesKey !== `${initialNodes.length}-${initialNodes[0]?.id || ''}`
    const edgesChanged = previousInitialEdgesRef.current !== initialEdges ||
                        initialEdgesKey !== `${initialEdges?.length || 0}-${initialEdges?.[0]?.id || ''}`
    
    if (nodesChanged || edgesChanged) {
      setNodes(initialNodes)
      setEdges(initialEdges || [])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
      processedNodesRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges, initialNodesKey, initialEdgesKey])

  const previousRecipeRef = useRef<string | undefined>(undefined)
  const previousMessageRef = useRef<string | undefined>(undefined)
  const previousStructuredRecipeRef = useRef<import('@/shared/api/chat/types').StructuredRecipe | undefined>(undefined)
  
  useEffect(() => {
    if (initialNodes && initialNodes.length > 0) {
      previousNodesRef.current = initialNodes
      previousNodesLengthRef.current = initialNodes.length
    }
    if (initialEdges && initialEdges.length > 0) {
      previousEdgesRef.current = initialEdges
      previousEdgesLengthRef.current = initialEdges.length
    }
  }, [initialNodes, initialEdges])
  
  useEffect(() => {
    const recipeChanged = recipe !== previousRecipeRef.current
    const messageChanged = message !== previousMessageRef.current
    const structuredRecipeChanged = JSON.stringify(structuredRecipe) !== JSON.stringify(previousStructuredRecipeRef.current)
    
    if ((recipe || message || structuredRecipe) && !initialNodes && (recipeChanged || messageChanged || structuredRecipeChanged)) {
      previousInitialNodesRef.current = undefined
      previousInitialEdgesRef.current = undefined
      previousRecipeRef.current = recipe
      previousMessageRef.current = message
      previousStructuredRecipeRef.current = structuredRecipe
      loadFlowData(recipe, message, structuredRecipe)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, message, structuredRecipe, initialNodes])

  const handleSave = () => {
    if (!nodes || nodes.length === 0) {
      antMessage.warning('No data to save')
      return
    }

    if (isSavedRecipe && onDelete) {
      Modal.confirm({
        title: 'Delete Recipe',
        content: 'Are you sure you want to delete this recipe?',
        okText: 'Delete',
        cancelText: 'Cancel',
        okButtonProps: { danger: true },
        onOk: () => {
          onDelete()
          antMessage.success('Recipe deleted')
        },
      })
      return
    }

    if (onSave) {
      const title = recipeTitle || `Recipe ${new Date().toLocaleDateString('en-US')}`
      onSave(nodes, edges, recipe, message, title)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance
  }, [])

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
    event.preventDefault()
    
    if (!reactFlowInstanceRef.current) return

    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    const clientX = event instanceof MouseEvent ? event.clientX : event.clientX
    const clientY = event instanceof MouseEvent ? event.clientY : event.clientY

    setContextMenu({
      x: clientX,
      y: clientY,
    })

    const position = reactFlowInstanceRef.current.screenToFlowPosition({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    })
    setClickPosition(position)
  }, [])

  const onCloseContextMenu = useCallback(() => {
    setContextMenu(null)
    setClickPosition(null)
  }, [])

  const onCloseEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu(null)
  }, [])

  const createEdgeCallbacks = useCallback((edgeId: string) => {
    return {
      onTimeChange: (newTime: string) => {
        setEdges((prevEdges) =>
          prevEdges.map((e) =>
            e.id === edgeId
              ? { ...e, data: { ...e.data, time: newTime } }
              : e
          )
        )
      },
    }
  }, [setEdges])

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    setEdgeContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    })
  }, [])

  const onChangeEdgeType = useCallback((edgeType: string | undefined) => {
    if (!edgeContextMenu) return

    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id !== edgeContextMenu.edgeId) return edge

        const callbacks = createEdgeCallbacks(edge.id)

        if (edgeType === 'timeEdge') {
          return {
            ...edge,
            type: edgeType,
            data: {
              ...edge.data,
              time: edge.data?.time || '',
              label: edge.data?.label || '',
              ...callbacks,
            },
          }
        }

        return {
          ...edge,
          type: edgeType,
          data: {
            ...edge.data,
            label: edge.data?.label || '',
          },
        }
      })
    )
  }, [edgeContextMenu, setEdges, createEdgeCallbacks])

  const createNodeCallbacks = useCallback((nodeId: string, nodeType?: string) => {
    return {
      onLabelChange: (newLabel: string) => {
        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, label: newLabel } }
              : n
          )
        )
      },
      onDescriptionChange: (newDescription: string) => {
        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, description: newDescription } }
              : n
          )
        )
      },
      ...(nodeType === 'ingredientNode' && {
        onIngredientsChange: (ingredients: any[]) => {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, ingredients } }
                : n
            )
          )
        },
      }),
    }
  }, [setNodes])

  const onAddNode = useCallback((nodeType: string) => {
    if (!clickPosition) return

    const nodeId = `node-${Date.now()}`
    const newNode: Node = {
      id: nodeId,
      type: nodeType,
      position: clickPosition,
      data: {
        label: nodeType === 'ingredientNode' ? 'Ingredients' :
               nodeType === 'preparationNode' ? 'Preparation' :
               nodeType === 'cookingNode' ? 'Cooking' :
               nodeType === 'servingNode' ? 'Serving' :
               nodeType === 'blockNode' ? 'Block' : 'New Node',
        description: '',
        ingredients: nodeType === 'ingredientNode' ? [] : undefined,
        ...createNodeCallbacks(nodeId, nodeType),
      },
    }

    setNodes((nds) => [...nds, newNode])
    processedNodesRef.current.add(nodeId)
    antMessage.success('Node added')
  }, [clickPosition, setNodes, createNodeCallbacks])

  const processedNodesRef = useRef<Set<string>>(new Set())
  
  useEffect(() => {
    const nodesNeedingCallbacks = nodes.filter(node => {
      const hasCallbacks = 
        typeof node.data.onLabelChange === 'function' &&
        typeof node.data.onDescriptionChange === 'function' &&
        (node.type !== 'ingredientNode' || typeof node.data.onIngredientsChange === 'function')
      return !hasCallbacks
    })

    if (nodesNeedingCallbacks.length === 0) {
      const currentIds = new Set(nodes.map(n => n.id))
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

    const currentIds = new Set(nodes.map(n => n.id))
    processedNodesRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        processedNodesRef.current.delete(id)
      }
    })
  }, [nodes.length, setNodes, createNodeCallbacks, initialNodes])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
      }

      if ((event.key === 'Control' || event.metaKey) && selectedNodeId && !isCreatingEdge) {
        setIsCreatingEdge(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsCreatingEdge(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedNodeId, isCreatingEdge])

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        onCloseContextMenu()
      }
      if (edgeContextMenu) {
        onCloseEdgeContextMenu()
      }
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [contextMenu, edgeContextMenu, onCloseContextMenu, onCloseEdgeContextMenu])

  const onNodesDelete: OnNodesDelete = useCallback((deleted) => {
    antMessage.info(`Deleted nodes: ${deleted.length}`)
  }, [])

  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    antMessage.info(`Deleted edges: ${deleted.length}`)
  }, [])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation()
    
    if (isCreatingEdge && selectedNodeId && selectedNodeId !== node.id) {
      setEdges((eds) => {
        const edgeExists = eds.some(
          (e) => (e.source === selectedNodeId && e.target === node.id) ||
                 (e.source === node.id && e.target === selectedNodeId)
        )
        if (edgeExists) {
          antMessage.warning('Edge already exists between these nodes')
          return eds
        }
        
        const newEdge: Edge = {
          id: `edge-${selectedNodeId}-${node.id}-${Date.now()}`,
          source: selectedNodeId,
          target: node.id,
          sourceHandle: 'source',
          targetHandle: 'target',
        }
        
        return [...eds, newEdge]
      })
      
      setIsCreatingEdge(false)
      setSelectedNodeId(node.id)
    } else if (!isCreatingEdge) {
      setSelectedNodeId(node.id)
    }
  }, [isCreatingEdge, selectedNodeId, setEdges])

  const onPaneClick = useCallback(() => {
    if (isCreatingEdge) {
      setIsCreatingEdge(false)
    }
  }, [isCreatingEdge])

  const onMiniMapClick = useCallback((_event: React.MouseEvent, position: { x: number; y: number }) => {
    if (!reactFlowInstanceRef.current) return
    
    const viewport = reactFlowInstanceRef.current.getViewport()
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    
    const centerX = position.x - bounds.width / 2 / viewport.zoom
    const centerY = position.y - bounds.height / 2 / viewport.zoom
    
    reactFlowInstanceRef.current.setViewport({
      x: -centerX * viewport.zoom,
      y: -centerY * viewport.zoom,
      zoom: viewport.zoom,
    }, { duration: 300 })
  }, [])

  return (
    <div className={styles.container} ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={useMemo(() => edges.map((edge) => {
          if (edge.type === 'timeEdge') {
            const callbacks = createEdgeCallbacks(edge.id)
            return {
              ...edge,
              data: {
                ...edge.data,
                ...callbacks,
              },
            }
          }
          return edge
        }), [edges, createEdgeCallbacks])}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Background />
        <Controls />
        <MiniMap 
          pannable={true}
          zoomable={true}
          onClick={onMiniMapClick}
          nodeColor={(node) => {
            if (node.type === 'ingredientNode') return '#52c41a'
            if (node.type === 'preparationNode') return '#ffc53d'
            if (node.type === 'cookingNode') return '#ff4d4f'
            if (node.type === 'servingNode') return '#1890ff'
            if (node.type === 'blockNode') return '#722ed1'
            return '#94a3b8'
          }}
          nodeStrokeWidth={2}
          maskColor="rgba(24, 144, 255, 0.15)"
          maskStrokeColor="#1890ff"
          maskStrokeWidth={2}
          className={styles.minimap}
        />
      </ReactFlow>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={onCloseContextMenu}
          onAddNode={onAddNode}
        />
      )}
      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          onClose={onCloseEdgeContextMenu}
          onChangeEdgeType={onChangeEdgeType}
        />
      )}
      {nodes && nodes.length > 0 && (onSave || onDelete) && (
        <div className={styles.saveButton}>
          <Button
            type="primary"
            icon={isSavedRecipe ? <HeartFilled /> : <HeartOutlined />}
            onClick={handleSave}
            disabled={isStreaming}
          >
          </Button>
        </div>
      )}
      {isStreaming && (
        <div className={styles.streamingIndicator}>
          <Spin size="small" />
          <span className={styles.streamingText}>Generating diagram...</span>
        </div>
      )}
    </div>
  )
}

