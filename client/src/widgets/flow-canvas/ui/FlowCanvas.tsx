import { useCallback, useEffect, useRef, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { IngredientNode } from '@/shared/ui/nodes/ingredientNode/IngredientNode'
import { PreparationNode } from '@/shared/ui/nodes/preparationNode/PreparationNode'
import { CookingNode } from '@/shared/ui/nodes/cookingNode/CookingNode'
import { ServingNode } from '@/shared/ui/nodes/servingNode/ServingNode'
import { BlockNode } from '@/shared/ui/nodes/blockNode/BlockNode'
import { TimeEdge } from '@/shared/ui/edges/TimeEdge'
import { ContextMenu } from './ContextMenu'
import { EdgeContextMenu } from './EdgeContextMenu'
import { message as antMessage, Modal, Spin } from 'antd'
import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Button } from '@/shared/ui/button/Button'
import { useFlowCanvasState } from '@/shared/lib/hooks/useFlowCanvasState'
import { useFlowDataLoader } from '@/shared/lib/hooks/useFlowDataLoader'
import { useFlowCanvasInteractions } from '@/shared/lib/hooks/useFlowCanvasInteractions'
import { useNodeCallbacks } from '@/shared/lib/hooks/useNodeCallbacks'
import { useEdgeCallbacks } from '@/shared/lib/hooks/useEdgeCallbacks'
import type { StructuredRecipe } from '@/shared/api/chat/types'
import styles from './flow-canvas.module.scss'

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

interface FlowCanvasProps {
  recipe?: string
  message?: string
  structuredRecipe?: StructuredRecipe
  onSave?: (nodes: any[], edges: any[], recipe?: string, message?: string, title?: string) => void
  onDelete?: () => void
  initialNodes?: any[]
  initialEdges?: any[]
  onNodesChange?: (nodes: any[]) => void
  onEdgesChange?: (edges: any[]) => void
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
  isSavedRecipe = false,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const previousRecipeRef = useRef<string | undefined>(undefined)
  const previousMessageRef = useRef<string | undefined>(undefined)
  const previousStructuredRecipeRef = useRef<StructuredRecipe | undefined>(undefined)

  // Управление состоянием nodes и edges
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange } = useFlowCanvasState({
    initialNodes,
    initialEdges,
    onNodesChange: externalOnNodesChange,
    onEdgesChange: externalOnEdgesChange,
  })

  // Загрузка flow данных
  const { isStreaming, recipeTitle, loadFlowData } = useFlowDataLoader({
    setNodes,
    setEdges,
    containerRef,
    reactFlowInstanceRef,
  })

  // Callbacks для nodes и edges
  const { createNodeCallbacks, processedNodesRef } = useNodeCallbacks({ nodes, setNodes })
  const { createEdgeCallbacks } = useEdgeCallbacks({ setEdges })

  // Интеракции (контекстные меню, клики и т.д.)
  const {
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
  } = useFlowCanvasInteractions({
    setNodes,
    setEdges,
    reactFlowInstanceRef,
    containerRef,
    createNodeCallbacks,
    processedNodesRef,
  })

  // Обработка изменения типа edge
  const onChangeEdgeType = useCallback(
    (edgeType: string | undefined) => {
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
    },
    [edgeContextMenu, setEdges, createEdgeCallbacks]
  )

  // Загрузка flow данных при изменении recipe/message/structuredRecipe
  useEffect(() => {
    const recipeChanged = recipe !== previousRecipeRef.current
    const messageChanged = message !== previousMessageRef.current
    const structuredRecipeChanged =
      JSON.stringify(structuredRecipe) !== JSON.stringify(previousStructuredRecipeRef.current)

    if (
      (recipe || message || structuredRecipe) &&
      !initialNodes &&
      (recipeChanged || messageChanged || structuredRecipeChanged)
    ) {
      previousRecipeRef.current = recipe
      previousMessageRef.current = message
      previousStructuredRecipeRef.current = structuredRecipe
      loadFlowData(recipe, message, structuredRecipe)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, message, structuredRecipe, initialNodes, loadFlowData])

  // Обработка сохранения/удаления
  const handleSave = useCallback(() => {
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
  }, [nodes, edges, isSavedRecipe, onDelete, onSave, recipe, message, recipeTitle])

  // Мемоизация edges с callbacks для timeEdge
  const edgesWithCallbacks = useMemo(
    () =>
      edges.map((edge) => {
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
      }),
    [edges, createEdgeCallbacks]
  )

  return (
    <div className={styles.container} ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={edgesWithCallbacks}
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
          ></Button>
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
