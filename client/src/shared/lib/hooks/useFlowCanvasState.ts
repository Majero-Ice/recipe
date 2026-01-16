import { useEffect, useRef } from 'react'
import { useNodesState, useEdgesState } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'

interface UseFlowCanvasStateOptions {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
}

export function useFlowCanvasState({
  initialNodes,
  initialEdges,
  onNodesChange,
  onEdgesChange,
}: UseFlowCanvasStateOptions) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes || [])
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges || [])

  const previousNodesRef = useRef<Node[]>([])
  const previousEdgesRef = useRef<Edge[]>([])
  const previousNodesLengthRef = useRef<number>(0)
  const previousEdgesLengthRef = useRef<number>(0)
  const nodesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const edgesChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const previousInitialNodesRef = useRef<Node[] | undefined>(undefined)
  const previousInitialEdgesRef = useRef<Edge[] | undefined>(undefined)

  // Синхронизация nodes с внешним колбэком
  useEffect(() => {
    if (nodesChangeTimeoutRef.current) {
      clearTimeout(nodesChangeTimeoutRef.current)
    }

    nodesChangeTimeoutRef.current = setTimeout(() => {
      const nodesChanged =
        nodes.length !== previousNodesLengthRef.current ||
        JSON.stringify(nodes.map((n) => ({ id: n.id, data: n.data, position: n.position }))) !==
          JSON.stringify(
            previousNodesRef.current?.map((n) => ({ id: n.id, data: n.data, position: n.position }))
          )

      if (nodesChanged && onNodesChange) {
        onNodesChange(nodes)
        previousNodesLengthRef.current = nodes.length
        previousNodesRef.current = nodes
      }
    }, 100)

    return () => {
      if (nodesChangeTimeoutRef.current) {
        clearTimeout(nodesChangeTimeoutRef.current)
      }
    }
  }, [nodes, onNodesChange])

  // Синхронизация edges с внешним колбэком
  useEffect(() => {
    if (edgesChangeTimeoutRef.current) {
      clearTimeout(edgesChangeTimeoutRef.current)
    }

    edgesChangeTimeoutRef.current = setTimeout(() => {
      const edgesChanged =
        edges.length !== previousEdgesLengthRef.current ||
        JSON.stringify(edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))) !==
          JSON.stringify(
            previousEdgesRef.current?.map((e) => ({ id: e.id, source: e.source, target: e.target }))
          )

      if (edgesChanged && onEdgesChange) {
        onEdgesChange(edges)
        previousEdgesLengthRef.current = edges.length
        previousEdgesRef.current = edges
      }
    }, 100)

    return () => {
      if (edgesChangeTimeoutRef.current) {
        clearTimeout(edgesChangeTimeoutRef.current)
      }
    }
  }, [edges, onEdgesChange])

  // Обновление nodes и edges при изменении initialNodes/initialEdges
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

    const initialNodesKey = `${initialNodes.length}-${initialNodes[0]?.id || ''}`
    const initialEdgesKey = `${initialEdges?.length || 0}-${initialEdges?.[0]?.id || ''}`

    const nodesChanged =
      previousInitialNodesRef.current !== initialNodes ||
      initialNodesKey !== `${previousInitialNodesRef.current?.length || 0}-${previousInitialNodesRef.current?.[0]?.id || ''}`
    const edgesChanged =
      previousInitialEdgesRef.current !== initialEdges ||
      initialEdgesKey !== `${previousInitialEdgesRef.current?.length || 0}-${previousInitialEdgesRef.current?.[0]?.id || ''}`

    if (nodesChanged || edgesChanged) {
      setNodes(initialNodes)
      setEdges(initialEdges || [])
      previousInitialNodesRef.current = initialNodes
      previousInitialEdgesRef.current = initialEdges || []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges])

  // Обновление previousNodesRef и previousEdgesRef при изменении initialNodes/initialEdges
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

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: onNodesChangeInternal,
    onEdgesChange: onEdgesChangeInternal,
  }
}


