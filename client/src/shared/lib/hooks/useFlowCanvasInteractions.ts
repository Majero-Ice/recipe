import { useState, useCallback, useEffect, useRef } from 'react'
import { addEdge } from '@xyflow/react'
import type { Node, Edge, Connection, ReactFlowInstance } from '@xyflow/react'
import { message as antMessage } from 'antd'

interface UseFlowCanvasInteractionsOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  reactFlowInstanceRef: React.RefObject<ReactFlowInstance | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  createNodeCallbacks: (nodeId: string, nodeType?: string) => any
  processedNodesRef: React.RefObject<Set<string>>
}

export function useFlowCanvasInteractions({
  setNodes,
  setEdges,
  reactFlowInstanceRef,
  containerRef,
  createNodeCallbacks,
  processedNodesRef,
}: UseFlowCanvasInteractionsOptions) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isCreatingEdge, setIsCreatingEdge] = useState(false)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance
  }, [reactFlowInstanceRef])

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
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
    },
    [reactFlowInstanceRef, containerRef]
  )

  const onCloseContextMenu = useCallback(() => {
    setContextMenu(null)
    setClickPosition(null)
  }, [])

  const onCloseEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu(null)
  }, [])

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    setEdgeContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    })
  }, [])

  const onAddNode = useCallback(
    (nodeType: string) => {
      if (!clickPosition) return

      const nodeId = `node-${Date.now()}`
      const newNode: Node = {
        id: nodeId,
        type: nodeType,
        position: clickPosition,
        data: {
          label:
            nodeType === 'ingredientNode'
              ? 'Ingredients'
              : nodeType === 'preparationNode'
                ? 'Preparation'
                : nodeType === 'cookingNode'
                  ? 'Cooking'
                  : nodeType === 'servingNode'
                    ? 'Serving'
                    : nodeType === 'blockNode'
                      ? 'Block'
                      : 'New Node',
          description: '',
          ingredients: nodeType === 'ingredientNode' ? [] : undefined,
          ...createNodeCallbacks(nodeId, nodeType),
        },
      }

      setNodes((nds) => [...nds, newNode])
      processedNodesRef.current?.add(nodeId)
      antMessage.success('Node added')
    },
    [clickPosition, setNodes, createNodeCallbacks, processedNodesRef]
  )

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation()

      if (isCreatingEdge && selectedNodeId && selectedNodeId !== node.id) {
        setEdges((eds) => {
          const edgeExists = eds.some(
            (e) =>
              (e.source === selectedNodeId && e.target === node.id) ||
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
    },
    [isCreatingEdge, selectedNodeId, setEdges]
  )

  const onPaneClick = useCallback(() => {
    if (isCreatingEdge) {
      setIsCreatingEdge(false)
    }
  }, [isCreatingEdge])

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
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

  // Закрытие контекстных меню при клике
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

  const onNodesDelete = useCallback((deleted: Node[]) => {
    antMessage.info(`Deleted nodes: ${deleted.length}`)
  }, [])

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    antMessage.info(`Deleted edges: ${deleted.length}`)
  }, [])

  const onMiniMapClick = useCallback(
    (_event: React.MouseEvent, position: { x: number; y: number }) => {
      if (!reactFlowInstanceRef.current) return

      const viewport = reactFlowInstanceRef.current.getViewport()
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return

      const centerX = position.x - bounds.width / 2 / viewport.zoom
      const centerY = position.y - bounds.height / 2 / viewport.zoom

      reactFlowInstanceRef.current.setViewport(
        {
          x: -centerX * viewport.zoom,
          y: -centerY * viewport.zoom,
          zoom: viewport.zoom,
        },
        { duration: 300 }
      )
    },
    [reactFlowInstanceRef, containerRef]
  )

  return {
    contextMenu,
    edgeContextMenu,
    onConnect,
    onInit,
    onPaneContextMenu,
    onCloseContextMenu,
    onCloseEdgeContextMenu,
    onEdgeContextMenu,
    onAddNode,
    onNodeClick,
    onPaneClick,
    onNodesDelete,
    onEdgesDelete,
    onMiniMapClick,
  }
}

