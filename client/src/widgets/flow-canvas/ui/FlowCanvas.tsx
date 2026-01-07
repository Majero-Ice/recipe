import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Node, Edge, Connection, ReactFlowInstance, OnNodesDelete, OnEdgesDelete } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DefaultNode } from '@/shared/ui/nodes/defaultNode/DefaultNode'
import { IngredientNode } from '@/shared/ui/nodes/ingredientNode/IngredientNode'
import { PreparationNode } from '@/shared/ui/nodes/preparationNode/PreparationNode'
import { CookingNode } from '@/shared/ui/nodes/cookingNode/CookingNode'
import { ServingNode } from '@/shared/ui/nodes/servingNode/ServingNode'
import { TimeEdge } from '@/shared/ui/edges/TimeEdge'
import { ContextMenu } from './ContextMenu'
import { recipeFlowApi } from '@/shared/api/recipe-flow/recipe-flow.api'
import type { FlowNode, FlowEdge, RecipeFlowResponse } from '@/shared/api/recipe-flow/types'
import { message as antMessage, Input, Modal } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux/hooks'
import { setNutritionalInfo } from '@/entities/recipe/model/recipe.slice'
import { Button } from '@/shared/ui/button/Button'
import styles from './flow-canvas.module.scss'

// Constants for layout - rigorous row-based approach
const NODE_WIDTH = 220 // Actual node width
const NODE_SPACING_X = 280 // Horizontal spacing between nodes (center to center)
const NODE_SPACING_Y = 250 // Vertical spacing between rows
const START_X = 100 // Starting X position (minimal padding)
const START_Y = 150 // Starting Y position
const MIN_PADDING = 50 // Minimum padding from edges

/**
 * Gets alternative handles for a given preferred handle, ordered by preference
 */
function getAlternativeHandles(preferredSourceHandle: string, preferredTargetHandle: string): Array<{ sourceHandle: string; targetHandle: string }> {
  const alternatives: Array<{ sourceHandle: string; targetHandle: string }> = []
  
  // Extract direction from preferred handles
  const sourceDir = preferredSourceHandle.replace('source-', '')
  const targetDir = preferredTargetHandle.replace('target-', '')
  
  // Add the preferred combination first
  alternatives.push({ sourceHandle: preferredSourceHandle, targetHandle: preferredTargetHandle })
  
  // Add alternatives with same direction but opposite side
  if (sourceDir === 'right' || sourceDir === 'left') {
    // Horizontal - try opposite horizontal
    const oppositeSource = sourceDir === 'right' ? 'source-left' : 'source-right'
    const oppositeTarget = targetDir === 'left' ? 'target-right' : 'target-left'
    alternatives.push({ sourceHandle: oppositeSource, targetHandle: oppositeTarget })
  }
  
  if (sourceDir === 'top' || sourceDir === 'bottom') {
    // Vertical - try opposite vertical
    const oppositeSource = sourceDir === 'top' ? 'source-bottom' : 'source-top'
    const oppositeTarget = targetDir === 'bottom' ? 'target-top' : 'target-bottom'
    alternatives.push({ sourceHandle: oppositeSource, targetHandle: oppositeTarget })
  }
  
  // Add perpendicular alternatives
  if (sourceDir === 'right' || sourceDir === 'left') {
    // Currently horizontal - try vertical alternatives
    alternatives.push({ sourceHandle: 'source-bottom', targetHandle: 'target-top' })
    alternatives.push({ sourceHandle: 'source-top', targetHandle: 'target-bottom' })
  } else {
    // Currently vertical - try horizontal alternatives
    alternatives.push({ sourceHandle: 'source-right', targetHandle: 'target-left' })
    alternatives.push({ sourceHandle: 'source-left', targetHandle: 'target-right' })
  }
  
  return alternatives
}

/**
 * Determines the optimal connection handles for an edge based on node positions
 * Uses rigorous structure: edges between rows use bottom->top handles
 * Edges within rows use left/right handles based on row direction
 * Ensures that each handle is only used by one edge
 */
function getOptimalHandles(
  sourceNode: Node,
  targetNode: Node,
  usedSourceHandles: Set<string>,
  usedTargetHandles: Set<string>,
): { sourceHandle: string; targetHandle: string } {
  const dx = targetNode.position.x - sourceNode.position.x
  const dy = targetNode.position.y - sourceNode.position.y
  const absDy = Math.abs(dy)

  // Determine if nodes are in the same row (similar Y coordinates)
  const SAME_ROW_THRESHOLD = 50 // pixels
  const isSameRow = absDy < SAME_ROW_THRESHOLD
  
  let preferredSourceHandle: string
  let preferredTargetHandle: string

  if (isSameRow) {
    // Nodes are in the same row - use horizontal handles
    if (dx > 0) {
      // Target is to the right of source
      preferredSourceHandle = 'source-right'
      preferredTargetHandle = 'target-left'
    } else {
      // Target is to the left of source
      preferredSourceHandle = 'source-left'
      preferredTargetHandle = 'target-right'
    }
  } else {
    // Nodes are in different rows - ALWAYS use vertical handles (bottom to top)
    // This ensures edges go vertically downward between rows
    if (dy > 0) {
      // Target is below source (shouldn't happen in our layout, but handle it)
      preferredSourceHandle = 'source-bottom'
      preferredTargetHandle = 'target-top'
    } else {
      // Target is above source (normal case: source in row N, target in row N+1)
      preferredSourceHandle = 'source-bottom'
      preferredTargetHandle = 'target-top'
    }
  }

  // Get alternative handle combinations
  const alternatives = getAlternativeHandles(preferredSourceHandle, preferredTargetHandle)
  
  // Find the first available combination
  for (const alt of alternatives) {
    const sourceHandleKey = `${sourceNode.id}:${alt.sourceHandle}`
    const targetHandleKey = `${targetNode.id}:${alt.targetHandle}`
    
    if (!usedSourceHandles.has(sourceHandleKey) && !usedTargetHandles.has(targetHandleKey)) {
      return alt
    }
  }
  
  // If all handles are taken, return the preferred one anyway
  return { sourceHandle: preferredSourceHandle, targetHandle: preferredTargetHandle }
}

/**
 * Calculates how many nodes fit per row based on available canvas width
 * Uses a more efficient calculation that accounts for actual node width and spacing
 */
function calculateNodesPerRow(containerWidth?: number): number {
  if (typeof window === 'undefined') return 4 // Default fallback
  
  let availableWidth: number
  
  if (containerWidth) {
    // Use provided container width
    availableWidth = containerWidth
  } else {
    // Calculate available width more accurately
    // Account for sidebar (typically ~320px, but can vary)
    // Use a more conservative estimate that works for most screen sizes
    const estimatedSidebarWidth = 320
    const viewportWidth = window.innerWidth
    
    // The canvas takes up the remaining space after sidebar
    availableWidth = viewportWidth - estimatedSidebarWidth
  }
  
  // Account for padding on both sides
  const usableWidth = availableWidth - (MIN_PADDING * 2)
  
  // Calculate nodes per row: (usableWidth + spacing) / (nodeWidth + spacing)
  // This accounts for the fact that spacing is center-to-center
  // Formula: we can fit nodes where: firstNodeStart + (n-1)*spacing + nodeWidth <= usableWidth
  // Simplified: n <= (usableWidth - nodeWidth + spacing) / spacing
  const nodesPerRow = Math.floor((usableWidth - NODE_WIDTH + NODE_SPACING_X) / NODE_SPACING_X)
  
  // Ensure at least 1 node per row, but prefer more for better layout
  return Math.max(1, nodesPerRow)
}

/**
 * Rigorous row-based layout with alternating directions
 * Nodes are arranged in rows that fit the screen width
 * Rows alternate direction: left-to-right, then right-to-left
 * Edges connect vertically between rows (bottom to top handles)
 */
function autoLayoutNodes(nodes: Node[], edges: Edge[], containerWidth?: number): Node[] {
  if (nodes.length === 0) return nodes

  // Build graph structure to determine levels
  const nodeLevels = new Map<string, number>()
  const children = new Map<string, string[]>()
  const parents = new Map<string, Set<string>>()
  
  // Initialize maps
  nodes.forEach((node) => {
    children.set(node.id, [])
    parents.set(node.id, new Set())
  })

  // Build graph
  edges.forEach((edge) => {
    children.get(edge.source)?.push(edge.target)
    parents.get(edge.target)?.add(edge.source)
  })

  // Find root nodes
  const roots = nodes.filter((n) => {
    const p = parents.get(n.id)
    return !p || p.size === 0 || n.type === 'ingredientNode'
  })

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = []
  roots.forEach((n) => {
    nodeLevels.set(n.id, 0)
    queue.push({ id: n.id, level: 0 })
  })

  if (queue.length === 0 && nodes.length > 0) {
    nodeLevels.set(nodes[0].id, 0)
    queue.push({ id: nodes[0].id, level: 0 })
  }

  const visited = new Set<string>()
  while (queue.length > 0) {
    const { id, level } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const childList = children.get(id) || []
    childList.forEach((childId) => {
      const currentLevel = nodeLevels.get(childId)
      const newLevel = level + 1
      if (currentLevel === undefined || newLevel > currentLevel) {
        nodeLevels.set(childId, newLevel)
        queue.push({ id: childId, level: newLevel })
      }
    })
  }

  // Sort nodes by level first (to maintain some hierarchy), then arrange sequentially in rows
  const sortedNodes = nodes.sort((a, b) => {
    const levelA = nodeLevels.get(a.id) ?? 0
    const levelB = nodeLevels.get(b.id) ?? 0
    if (levelA !== levelB) return levelA - levelB
    // If same level, maintain original order
    return 0
  })

  // Calculate nodes per row based on available canvas width
  const nodesPerRow = calculateNodesPerRow(containerWidth)

  // Position nodes sequentially in rows with alternating directions
  // Fill rows completely before moving to the next row, regardless of level
  const positionedNodes: Node[] = []
  let globalRowIndex = 0 // Track global row index

  // Process all nodes sequentially, filling rows
  for (let i = 0; i < sortedNodes.length; i += nodesPerRow) {
    const rowNodes = sortedNodes.slice(i, i + nodesPerRow)
    const isEvenRow = globalRowIndex % 2 === 0 // Even rows go left-to-right, odd rows go right-to-left

    rowNodes.forEach((node, colIndex) => {
      let x: number
      if (isEvenRow) {
        // Left-to-right: first node at START_X, subsequent nodes spaced to the right
        x = START_X + colIndex * NODE_SPACING_X
      } else {
        // Right-to-left: first node at rightmost position, subsequent nodes spaced to the left
        const rowWidth = (rowNodes.length - 1) * NODE_SPACING_X
        x = START_X + rowWidth - (colIndex * NODE_SPACING_X)
      }

      const y = START_Y + globalRowIndex * NODE_SPACING_Y

      positionedNodes.push({
        ...node,
        position: {
          x: Math.round(x),
          y: Math.round(y),
        },
      })
    })
    
    globalRowIndex++ // Move to next row
  }

  return positionedNodes
}

const nodeTypes = {
  defaultNode: DefaultNode,
  ingredientNode: IngredientNode,
  preparationNode: PreparationNode,
  cookingNode: CookingNode,
  servingNode: ServingNode,
}

const edgeTypes = {
  timeEdge: TimeEdge,
}

const initialNodes: Node[] = []

const initialEdges: Edge[] = []

interface FlowCanvasProps {
  recipe?: string
  message?: string
  onSave?: (nodes: Node[], edges: Edge[], recipe?: string, message?: string) => void
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
  isSavedRecipe?: boolean
}

export function FlowCanvas({ 
  recipe, 
  message, 
  onSave, 
  initialNodes, 
  initialEdges, 
  onNodesChange: externalOnNodesChange,
  onEdgesChange: externalOnEdgesChange,
  isSavedRecipe = false 
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || [])
  
  // Отслеживаем изменения nodes и edges для уведомления внешних компонентов
  const previousNodesRef = useRef<Node[]>([])
  const previousEdgesRef = useRef<Edge[]>([])
  const previousNodesLengthRef = useRef<number>(0)
  const previousEdgesLengthRef = useRef<number>(0)
  const nodesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const edgesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Используем debounce для избежания лишних обновлений
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
    // Используем debounce для избежания лишних обновлений
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dispatch = useAppDispatch()
  const nutritionalInfo = useAppSelector((state) => state.recipe.nutritionalInfo)
  const previousInitialNodesRef = useRef<Node[] | undefined>(undefined)
  const previousInitialEdgesRef = useRef<Edge[] | undefined>(undefined)
  
  // Используем более эффективное сравнение - по длине и первому элементу вместо полного JSON.stringify
  const initialNodesKey = useMemo(() => {
    if (!initialNodes || initialNodes.length === 0) return ''
    return `${initialNodes.length}-${initialNodes[0]?.id || ''}`
  }, [initialNodes])
  
  const initialEdgesKey = useMemo(() => {
    if (!initialEdges || initialEdges.length === 0) return ''
    return `${initialEdges.length}-${initialEdges[0]?.id || ''}`
  }, [initialEdges])

  const loadFlowData = useCallback(async (recipeText?: string, messageText?: string) => {
    if (!recipeText && !messageText) return

    setIsStreaming(true)
    
    // Clear existing nodes and edges
    setNodes([])
    setEdges([])

    // Accumulate nodes and edges as they arrive
    const accumulatedNodes = new Map<string, Node>()
    const accumulatedEdges = new Map<string, Edge>()

    try {
      await recipeFlowApi.streamFlow(
        {
          recipe: recipeText,
          message: messageText,
        },
            // onNode - add node in real-time
            (node: FlowNode) => {
              const nodeType = node.type && nodeTypes[node.type as keyof typeof nodeTypes] 
                ? node.type 
                : 'defaultNode'
              
              const reactFlowNode: Node = {
                id: node.id,
                type: nodeType,
                position: { x: 0, y: 0 }, // Temporary position, will be recalculated
                data: node.data,
              }

              accumulatedNodes.set(node.id, reactFlowNode)
              
              // Update nodes and recalculate layout immediately
              const currentNodes = Array.from(accumulatedNodes.values())
              const currentEdges = Array.from(accumulatedEdges.values())
              const containerWidth = containerRef.current?.clientWidth
              const positionedNodes = autoLayoutNodes(currentNodes, currentEdges, containerWidth)
              
              // Recalculate optimal handles for all edges based on new positions
              // Track which handles are already in use to ensure each handle is only used once
              const usedSourceHandles = new Set<string>()
              const usedTargetHandles = new Set<string>()
              
              const updatedEdges = currentEdges.map((edge) => {
                const sourceNode = positionedNodes.find((n) => n.id === edge.source)
                const targetNode = positionedNodes.find((n) => n.id === edge.target)
                
                if (sourceNode && targetNode) {
                  const handles = getOptimalHandles(sourceNode, targetNode, usedSourceHandles, usedTargetHandles)
                  
                  // Mark handles as used
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
              
              // Auto-fit view as nodes are added (with slight delay for smooth animation)
              setTimeout(() => {
                if (reactFlowInstanceRef.current) {
                  reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 200 })
                }
              }, 50)
            },
        // onEdge - add edge in real-time
        (edge: FlowEdge) => {
          const hasTime = edge.time && edge.time.trim().length > 0
          
          // Create edge without handles first - we'll calculate them after layout
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
          
          // Update edges and recalculate layout FIRST
          const currentNodes = Array.from(accumulatedNodes.values())
          const currentEdges = Array.from(accumulatedEdges.values())
          const containerWidth = containerRef.current?.clientWidth
          const positionedNodes = autoLayoutNodes(currentNodes, currentEdges, containerWidth)
          
          // NOW calculate optimal handles for all edges based on POSITIONED nodes
          // Track which handles are already in use to ensure each handle is only used once
          const usedSourceHandles = new Set<string>()
          const usedTargetHandles = new Set<string>()
          
          const updatedEdges = currentEdges.map((e) => {
            const srcNode = positionedNodes.find((n) => n.id === e.source)
            const tgtNode = positionedNodes.find((n) => n.id === e.target)
            
            if (srcNode && tgtNode) {
              const handles = getOptimalHandles(srcNode, tgtNode, usedSourceHandles, usedTargetHandles)
              
              // Mark handles as used
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
          
          // Auto-fit view as edges are added
          setTimeout(() => {
            if (reactFlowInstanceRef.current) {
              reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 200 })
            }
          }, 100)
        },
        // onComplete - final update with complete data
        (response: RecipeFlowResponse) => {
          // Convert all nodes
          const flowNodes: Node[] = response.nodes.map((node: FlowNode) => {
            const nodeType = node.type && nodeTypes[node.type as keyof typeof nodeTypes] 
              ? node.type 
              : 'defaultNode'
            
            return {
              id: node.id,
              type: nodeType,
              position: { x: 0, y: 0 },
              data: node.data,
            }
          })

          // Convert all edges WITHOUT handles first - we'll calculate them after layout
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

          // Apply final layout FIRST to get positioned nodes
          const containerWidth = containerRef.current?.clientWidth
          const positionedNodes = autoLayoutNodes(flowNodes, flowEdges, containerWidth)
          
          // NOW calculate optimal handles for all edges based on POSITIONED nodes
          // Track which handles are already in use to ensure each handle is only used once
          const usedSourceHandles = new Set<string>()
          const usedTargetHandles = new Set<string>()
          
          const edgesWithHandles = flowEdges.map((edge) => {
            const sourceNode = positionedNodes.find((n) => n.id === edge.source)
            const targetNode = positionedNodes.find((n) => n.id === edge.target)
            
            if (sourceNode && targetNode) {
              const handles = getOptimalHandles(sourceNode, targetNode, usedSourceHandles, usedTargetHandles)
              
              // Mark handles as used
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
          
          // Final fit view
          setTimeout(() => {
            if (reactFlowInstanceRef.current) {
              reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 400 })
            }
          }, 300)
          
          // Mark streaming as complete
          setIsStreaming(false)

          // Save nutritional info to Redux store
          if (response.nutritionalInfo) {
            dispatch(setNutritionalInfo(response.nutritionalInfo))
          } else {
            dispatch(setNutritionalInfo(null))
          }
        },
        // onError
        (error: Error) => {
          antMessage.error(error.message || 'Failed to generate flow diagram')
          console.error('Error streaming flow data:', error)
          setIsStreaming(false)
        },
      )
    } catch (error) {
      antMessage.error(error instanceof Error ? error.message : 'Failed to load flow diagram')
      console.error('Error loading flow data:', error)
      setIsStreaming(false)
    }
  }, [setNodes, setEdges])

  // Загружаем сохранённые узлы и рёбра только при изменении initialNodes/initialEdges
  useEffect(() => {
    // Если initialNodes не определен, пропускаем (ожидание генерации или загрузки)
    if (initialNodes === undefined) {
      // Если initialNodes стал undefined, сбрасываем предыдущие значения
      previousInitialNodesRef.current = undefined
      previousInitialEdgesRef.current = undefined
      return
    }

    // Если initialNodes это пустой массив, очищаем nodes и edges
    if (initialNodes.length === 0) {
      setNodes([])
      setEdges([])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
      return
    }

    // Проверяем, изменились ли данные, сравнивая ссылки и ключи
    const nodesChanged = previousInitialNodesRef.current !== initialNodes || 
                        initialNodesKey !== `${initialNodes.length}-${initialNodes[0]?.id || ''}`
    const edgesChanged = previousInitialEdgesRef.current !== initialEdges ||
                        initialEdgesKey !== `${initialEdges?.length || 0}-${initialEdges?.[0]?.id || ''}`
    
    if (nodesChanged || edgesChanged) {
      // Загружаем сохранённые узлы и рёбра только если они действительно изменились
      setNodes(initialNodes)
      setEdges(initialEdges || [])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges, initialNodesKey, initialEdgesKey])

  // Загружаем flow данные только если нет initialNodes (чтобы не перезаписывать загруженный рецепт)
  const previousRecipeRef = useRef<string | undefined>(undefined)
  const previousMessageRef = useRef<string | undefined>(undefined)
  
  // Инициализируем refs при загрузке initialNodes/initialEdges
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
    // Проверяем, изменились ли recipe или message
    const recipeChanged = recipe !== previousRecipeRef.current
    const messageChanged = message !== previousMessageRef.current
    
    if ((recipe || message) && !initialNodes && (recipeChanged || messageChanged)) {
      // Сбрасываем предыдущие значения при загрузке нового рецепта
      previousInitialNodesRef.current = ''
      previousInitialEdgesRef.current = ''
      previousRecipeRef.current = recipe
      previousMessageRef.current = message
      loadFlowData(recipe, message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, message, initialNodes])

  const handleSave = () => {
    if (!nodes || nodes.length === 0) {
      antMessage.warning('Нет данных для сохранения')
      return
    }

    Modal.confirm({
      title: 'Сохранить рецепт',
      content: (
        <div style={{ marginTop: 16 }}>
          <Input
            placeholder="Название рецепта"
            id="recipe-name-input"
            onPressEnter={(e) => {
              const input = e.currentTarget
              const name = input.value.trim() || `Рецепт ${new Date().toLocaleDateString('ru-RU')}`
              if (onSave) {
                onSave(nodes, edges, recipe, message)
              }
              Modal.destroyAll()
            }}
            autoFocus
          />
        </div>
      ),
      okText: 'Сохранить',
      cancelText: 'Отмена',
      onOk: () => {
        const input = document.getElementById('recipe-name-input') as HTMLInputElement
        const name = input?.value.trim() || `Рецепт ${new Date().toLocaleDateString('ru-RU')}`
        if (onSave) {
          onSave(nodes, edges, recipe, message)
        }
      },
    })
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance
  }, [])

  // Context menu handlers
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    
    if (!reactFlowInstanceRef.current) return

    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    })

    // Store the click position in flow coordinates for node creation
    const position = reactFlowInstanceRef.current.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
    setClickPosition(position)
  }, [])

  const onCloseContextMenu = useCallback(() => {
    setContextMenu(null)
    setClickPosition(null)
  }, [])

  const onAddNode = useCallback((nodeType: string) => {
    if (!clickPosition) return

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: clickPosition,
      data: {
        label: nodeType === 'ingredientNode' ? 'Ингредиенты' :
               nodeType === 'preparationNode' ? 'Подготовка' :
               nodeType === 'cookingNode' ? 'Приготовление' :
               nodeType === 'servingNode' ? 'Подача' : 'Новый узел',
        description: '',
        ingredients: nodeType === 'ingredientNode' ? [] : undefined,
        onLabelChange: (newLabel: string) => {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === newNode.id
                ? { ...node, data: { ...node.data, label: newLabel } }
                : node
            )
          )
        },
        onDescriptionChange: (newDescription: string) => {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === newNode.id
                ? { ...node, data: { ...node.data, description: newDescription } }
                : node
            )
          )
        },
      },
    }

    setNodes((nds) => [...nds, newNode])
    antMessage.success('Узел добавлен')
  }, [clickPosition, setNodes])

  // Update node data handlers for existing nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onLabelChange: (newLabel: string) => {
            setNodes((prevNodes) =>
              prevNodes.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, label: newLabel } }
                  : n
              )
            )
          },
          onDescriptionChange: (newDescription: string) => {
            setNodes((prevNodes) =>
              prevNodes.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, description: newDescription } }
                  : n
              )
            )
          },
        },
      }))
    )
  }, [setNodes])

  // Handle node/edge deletion with keyboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're not in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        // ReactFlow will handle this automatically with the right props
        // We just need to make sure nodes/edges are deletable
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        onCloseContextMenu()
      }
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [contextMenu, onCloseContextMenu])

  // Callback when nodes are deleted
  const onNodesDelete: OnNodesDelete = useCallback((deleted) => {
    antMessage.info(`Удалено узлов: ${deleted.length}`)
  }, [])

  // Callback when edges are deleted
  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    antMessage.info(`Удалено связей: ${deleted.length}`)
  }, [])

  return (
    <div className={styles.container} ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onPaneContextMenu={onPaneContextMenu}
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
        <MiniMap />
      </ReactFlow>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={onCloseContextMenu}
          onAddNode={onAddNode}
        />
      )}
      {nodes && nodes.length > 0 && onSave && !isSavedRecipe && (
        <div className={styles.saveButton}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={isStreaming}
          >
            Сохранить рецепт
          </Button>
        </div>
      )}
      {isSavedRecipe && nodes && nodes.length > 0 && (
        <div className={styles.saveButton}>
          <div className={styles.autoSaveIndicator}>
            Изменения сохраняются автоматически
          </div>
        </div>
      )}
      {isStreaming && (
        <div className={styles.streamingIndicator}>
          <div className={styles.streamingText}>Adding nodes...</div>
        </div>
      )}
    </div>
  )
}

