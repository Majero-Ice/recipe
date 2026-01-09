import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Node, Edge, Connection, ReactFlowInstance, OnNodesDelete, OnEdgesDelete } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DefaultNode } from '@/shared/ui/nodes/defaultNode/DefaultNode'
import { IngredientNode } from '@/shared/ui/nodes/ingredientNode/IngredientNode'
import { PreparationNode } from '@/shared/ui/nodes/preparationNode/PreparationNode'
import { CookingNode } from '@/shared/ui/nodes/cookingNode/CookingNode'
import { ServingNode } from '@/shared/ui/nodes/servingNode/ServingNode'
import { BlockNode } from '@/shared/ui/nodes/blockNode/BlockNode'
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
 * Determines the optimal connection handles for an edge
 * All nodes now use single center handles: "source" and "target"
 */
function getOptimalHandles(
  sourceNode: Node,
  targetNode: Node,
  usedSourceHandles: Set<string>,
  usedTargetHandles: Set<string>,
): { sourceHandle: string; targetHandle: string } {
  // All nodes now use single center handles
  const sourceHandle = 'source'
  const targetHandle = 'target'
  
  // Since we have only one handle per node, we can reuse it for multiple connections
  // ReactFlow will handle multiple connections to the same handle
  return { sourceHandle, targetHandle }
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
 * Block-based layout algorithm
 * Organizes nodes into parallel blocks:
 * - Blocks are positioned vertically (one below another)
 * - Nodes within each block flow horizontally (left to right)
 * - After blocks merge, nodes flow vertically (top to bottom) in center
 */
function autoLayoutNodes(nodes: Node[], edges: Edge[], containerWidth?: number): Node[] {
  if (nodes.length === 0) return nodes

  // Build graph structure
  const children = new Map<string, string[]>()
  const parents = new Map<string, Set<string>>()
  const nodeMap = new Map<string, Node>()
  
  // Initialize maps
  nodes.forEach((node) => {
    children.set(node.id, [])
    parents.set(node.id, new Set())
    nodeMap.set(node.id, node)
  })

  // Build graph
  edges.forEach((edge) => {
    children.get(edge.source)?.push(edge.target)
    parents.get(edge.target)?.add(edge.source)
  })

  // Find ingredient node (root)
  const ingredientNode = nodes.find(n => n.type === 'ingredientNode')
  if (!ingredientNode) {
    // Fallback to simple layout if no ingredient node
    return simpleLayout(nodes, containerWidth)
  }

  // Find all block nodes directly connected from ingredient node
  const blockNodes = children.get(ingredientNode.id)?.map(id => nodeMap.get(id)!).filter(n => n?.type === 'blockNode') || []
  
  // If no block nodes, use simple layout
  if (blockNodes.length === 0) {
    return simpleLayout(nodes, containerWidth)
  }

  const positionedNodes: Node[] = []
  const positioned = new Set<string>()

  // Process each block - build chains from block nodes
  // A block chain includes all nodes from blockNode until merge point (node with multiple parents)
  const blockChains: Array<{ blockNode: Node; chain: Node[]; mergeNodeId?: string }> = []
  const allVisitedInBlocks = new Set<string>()
  
  blockNodes.forEach((blockNode) => {
    // Build chain for this block - include ALL nodes that belong to this block
    const chain: Node[] = [blockNode]
    const blockVisited = new Set<string>([blockNode.id])
    allVisitedInBlocks.add(blockNode.id)
    
    // Follow the chain from block node until we hit a merge point or end
    let currentNode = blockNode
    let mergeNodeId: string | undefined = undefined
    
    while (true) {
      const nextNodes = children.get(currentNode.id)?.filter(id => !blockVisited.has(id)) || []
      if (nextNodes.length === 0) break
      
      // Take first child (sequential flow within block)
      const nextId = nextNodes[0]
      const nextNode = nodeMap.get(nextId)!
      
      // Check if this node is a merge point (has multiple parents from different blocks)
      const nodeParents = parents.get(nextId) || new Set()
      if (nodeParents.size > 1) {
        // This is a merge node - don't include it in the block chain
        mergeNodeId = nextId
        allVisitedInBlocks.add(nextId)
        break
      }
      
      // Check if any other child is a merge point (shouldn't happen in sequential flow, but check anyway)
      const hasMergeChild = nextNodes.some(id => {
        const childParents = parents.get(id) || new Set()
        return childParents.size > 1
      })
      
      if (hasMergeChild && nextNodes.length > 1) {
        // Find the merge node
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
      
      // Add node to chain (it's part of this block)
      chain.push(nextNode)
      blockVisited.add(nextId)
      allVisitedInBlocks.add(nextId)
      currentNode = nextNode
    }
    
    blockChains.push({ blockNode, chain, mergeNodeId })
  })

  // Calculate positions
  const centerX = containerWidth ? containerWidth / 2 - NODE_WIDTH / 2 : 400
  const leftX = START_X // Left side for ingredient node
  
  // Position blocks: each block on its own row, nodes within block go horizontally (left to right)
  // Blocks start from center and go horizontally
  const blockStartX = centerX - 200 // Start blocks slightly left of center
  let maxBlockX = blockStartX // Track the rightmost position of any block
  
  blockChains.forEach(({ chain, mergeNodeId }, blockIndex) => {
    const blockY = START_Y + blockIndex * NODE_SPACING_Y
    
    // Position ALL nodes in chain horizontally (left to right) on the same row
    chain.forEach((node, nodeIndex) => {
      if (positioned.has(node.id)) return
      
      const nodeX = blockStartX + nodeIndex * NODE_SPACING_X
      maxBlockX = Math.max(maxBlockX, nodeX + NODE_WIDTH) // Track rightmost edge
      
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
  
  // Calculate rightX: position merge node on the right side, similar to ingredient on left
  // Always position on the right edge of the canvas, regardless of block positions
  let rightX: number
  if (containerWidth) {
    // Use container width minus padding (same approach as leftX)
    rightX = containerWidth - NODE_WIDTH - START_X
  } else {
    // Calculate based on viewport width, accounting for sidebar
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const estimatedSidebarWidth = 320
    const availableWidth = viewportWidth - estimatedSidebarWidth
    rightX = availableWidth - NODE_WIDTH - START_X
  }
  
  // Ensure merge node is at least to the right of all blocks
  const minRightX = maxBlockX + NODE_SPACING_X
  rightX = Math.max(rightX, minRightX)

  // Calculate middle Y position of all blocks for ingredient and merge nodes
  const firstBlockY = START_Y
  const lastBlockY = START_Y + (blockChains.length - 1) * NODE_SPACING_Y
  const middleY = (firstBlockY + lastBlockY) / 2

  // Position ingredient node on the left, at middle Y of blocks
  positionedNodes.push({
    ...ingredientNode,
    position: { x: Math.round(leftX), y: Math.round(middleY) },
  })
  positioned.add(ingredientNode.id)

  // Collect all merge nodes
  const allMergeNodes = new Set<string>()
  blockChains.forEach(({ mergeNodeId }) => {
    if (mergeNodeId) allMergeNodes.add(mergeNodeId)
  })

  // Position merge nodes on the right, at middle Y of blocks
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

  // Find and position nodes after merge (snake pattern: right-to-left, then new row below)
  const nodesAfterMerge: Node[] = []
  const visitedAfterMerge = new Set<string>()
  
  const findNodesAfter = (nodeId: string, depth: number = 0) => {
    if (depth > 20) return // Prevent infinite loops
    
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

  // Start from all merge nodes
  allMergeNodes.forEach(mergeNodeId => {
    findNodesAfter(mergeNodeId)
  })

  // Position nodes after merge in snake pattern (all rows go right-to-left)
  const nodesPerRow = calculateNodesPerRow(containerWidth)
  const mergeStartY = lastBlockY + NODE_SPACING_Y // Start below merge node
  
  nodesAfterMerge.forEach((node, index) => {
    if (positioned.has(node.id)) return
    
    const rowIndex = Math.floor(index / nodesPerRow)
    const colIndex = index % nodesPerRow
    
    // All rows go right-to-left: start from right, go left
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

  // Position any remaining unpositioned nodes
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

/**
 * Simple fallback layout for non-block structures
 */
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
  defaultNode: DefaultNode,
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
  
  // Track changes in nodes and edges to notify external components
  const previousNodesRef = useRef<Node[]>([])
  const previousEdgesRef = useRef<Edge[]>([])
  const previousNodesLengthRef = useRef<number>(0)
  const previousEdgesLengthRef = useRef<number>(0)
  const nodesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const edgesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Use debounce to avoid unnecessary updates
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
    // Use debounce to avoid unnecessary updates
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
  
  // Use more efficient comparison - by length and first element instead of full JSON.stringify
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

  // Load saved nodes and edges only when initialNodes/initialEdges change
  useEffect(() => {
    // If initialNodes is undefined, skip (waiting for generation or loading)
    if (initialNodes === undefined) {
      // If initialNodes became undefined, reset previous values
      previousInitialNodesRef.current = undefined
      previousInitialEdgesRef.current = undefined
      return
    }

    // If initialNodes is empty array, clear nodes and edges
    if (initialNodes.length === 0) {
      setNodes([])
      setEdges([])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
      return
    }

    // Check if data changed by comparing references and keys
    const nodesChanged = previousInitialNodesRef.current !== initialNodes || 
                        initialNodesKey !== `${initialNodes.length}-${initialNodes[0]?.id || ''}`
    const edgesChanged = previousInitialEdgesRef.current !== initialEdges ||
                        initialEdgesKey !== `${initialEdges?.length || 0}-${initialEdges?.[0]?.id || ''}`
    
    if (nodesChanged || edgesChanged) {
      // Load saved nodes and edges only if they actually changed
      setNodes(initialNodes)
      setEdges(initialEdges || [])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
      // Reset processed nodes ref so callbacks get re-initialized for loaded nodes
      processedNodesRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges, initialNodesKey, initialEdgesKey])

  // Load flow data only if there are no initialNodes (to avoid overwriting loaded recipe)
  const previousRecipeRef = useRef<string | undefined>(undefined)
  const previousMessageRef = useRef<string | undefined>(undefined)
  
  // Initialize refs when loading initialNodes/initialEdges
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
    // Check if recipe or message changed
    const recipeChanged = recipe !== previousRecipeRef.current
    const messageChanged = message !== previousMessageRef.current
    
    if ((recipe || message) && !initialNodes && (recipeChanged || messageChanged)) {
      // Reset previous values when loading new recipe
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
      antMessage.warning('No data to save')
      return
    }

    Modal.confirm({
      title: 'Save Recipe',
      content: (
        <div style={{ marginTop: 16 }}>
          <Input
            placeholder="Recipe name"
            id="recipe-name-input"
            onPressEnter={(e) => {
              const input = e.currentTarget
              const name = input.value.trim() || `Recipe ${new Date().toLocaleDateString('en-US')}`
              if (onSave) {
                onSave(nodes, edges, recipe, message)
              }
              Modal.destroyAll()
            }}
            autoFocus
          />
        </div>
      ),
      okText: 'Save',
      cancelText: 'Cancel',
      onOk: () => {
        const input = document.getElementById('recipe-name-input') as HTMLInputElement
        const name = input?.value.trim() || `Recipe ${new Date().toLocaleDateString('en-US')}`
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

  // Helper function to create callbacks for a node
  // Must be defined before onAddNode since it's used there
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

  // Update node data handlers for existing nodes
  // Always ensure callbacks are present and working
  // Use a ref to track which nodes have been processed
  const processedNodesRef = useRef<Set<string>>(new Set())
  
  useEffect(() => {
    // Check if any node is missing callbacks
    const nodesNeedingCallbacks = nodes.filter(node => {
      const hasCallbacks = 
        typeof node.data.onLabelChange === 'function' &&
        typeof node.data.onDescriptionChange === 'function' &&
        (node.type !== 'ingredientNode' || typeof node.data.onIngredientsChange === 'function')
      return !hasCallbacks
    })

    if (nodesNeedingCallbacks.length === 0) {
      // Update processed ref
      const currentIds = new Set(nodes.map(n => n.id))
      processedNodesRef.current = currentIds
      return // All nodes have valid callbacks
    }

    // Update only nodes that need callbacks
    setNodes((nds) =>
      nds.map((node) => {
        const needsCallbacks = 
          typeof node.data.onLabelChange !== 'function' ||
          typeof node.data.onDescriptionChange !== 'function' ||
          (node.type === 'ingredientNode' && typeof node.data.onIngredientsChange !== 'function')

        if (!needsCallbacks) {
          processedNodesRef.current.add(node.id)
          return node // Already has valid callbacks
        }

        // Create new callbacks using functional updates
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

    // Clean up ref for deleted nodes
    const currentIds = new Set(nodes.map(n => n.id))
    processedNodesRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        processedNodesRef.current.delete(id)
      }
    })
  }, [nodes.length, setNodes, createNodeCallbacks, initialNodes]) // Update when nodes count changes or initialNodes change

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
    antMessage.info(`Deleted nodes: ${deleted.length}`)
  }, [])

  // Callback when edges are deleted
  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    antMessage.info(`Deleted edges: ${deleted.length}`)
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
            Save Recipe
          </Button>
        </div>
      )}
      {isSavedRecipe && nodes && nodes.length > 0 && (
        <div className={styles.saveButton}>
          <div className={styles.autoSaveIndicator}>
            Changes are saved automatically
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

