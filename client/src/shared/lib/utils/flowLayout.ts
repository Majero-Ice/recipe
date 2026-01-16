import type { Node, Edge } from '@xyflow/react'

export const NODE_WIDTH = 220
export const NODE_SPACING_X = 280
export const NODE_SPACING_Y = 250
export const START_X = 100
export const START_Y = 150
export const MIN_PADDING = 50

export function calculateNodesPerRow(containerWidth?: number): number {
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

export function getOptimalHandles(
  sourceNode: Node,
  targetNode: Node,
  usedSourceHandles: Set<string>,
  usedTargetHandles: Set<string>,
): { sourceHandle: string; targetHandle: string } {
  const sourceHandle = 'source'
  const targetHandle = 'target'

  return { sourceHandle, targetHandle }
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

export function autoLayoutNodes(nodes: Node[], edges: Edge[], containerWidth?: number): Node[] {
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

  const ingredientNode = nodes.find((n) => n.type === 'ingredientNode')
  if (!ingredientNode) {
    return simpleLayout(nodes, containerWidth)
  }

  const blockNodes =
    children
      .get(ingredientNode.id)
      ?.map((id) => nodeMap.get(id)!)
      .filter((n) => n?.type === 'blockNode') || []

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
      const nextNodes = children.get(currentNode.id)?.filter((id) => !blockVisited.has(id)) || []
      if (nextNodes.length === 0) break

      const nextId = nextNodes[0]
      const nextNode = nodeMap.get(nextId)!

      const nodeParents = parents.get(nextId) || new Set()
      if (nodeParents.size > 1) {
        mergeNodeId = nextId
        allVisitedInBlocks.add(nextId)
        break
      }

      const hasMergeChild = nextNodes.some((id) => {
        const childParents = parents.get(id) || new Set()
        return childParents.size > 1
      })

      if (hasMergeChild && nextNodes.length > 1) {
        const mergeChild = nextNodes.find((id) => {
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

  allMergeNodes.forEach((mergeNodeId) => {
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
    childrenIds.forEach((childId) => {
      if (visitedAfterMerge.has(childId)) return
      visitedAfterMerge.add(childId)

      const child = nodeMap.get(childId)!
      if (!positioned.has(childId)) {
        nodesAfterMerge.push(child)
        findNodesAfter(childId, depth + 1)
      }
    })
  }

  allMergeNodes.forEach((mergeNodeId) => {
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

  nodes.forEach((node) => {
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


