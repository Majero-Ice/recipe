import { memo } from 'react'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import { 
  ShoppingOutlined, 
  ExperimentOutlined, 
  FireOutlined, 
  CheckCircleOutlined, 
  ApartmentOutlined
} from '@ant-design/icons'
import styles from './context-menu.module.scss'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onAddNode: (nodeType: string) => void
}

const menuItems: MenuProps['items'] = [
  {
    key: 'blockNode',
    icon: <ApartmentOutlined />,
    label: 'Block',
  },
  {
    key: 'ingredientNode',
    icon: <ShoppingOutlined />,
    label: 'Ingredients',
  },
  {
    key: 'preparationNode',
    icon: <ExperimentOutlined />,
    label: 'Preparation',
  },
  {
    key: 'cookingNode',
    icon: <FireOutlined />,
    label: 'Cooking',
  },
  {
    key: 'servingNode',
    icon: <CheckCircleOutlined />,
    label: 'Serving',
  },
]

function ContextMenuComponent({ x, y, onClose, onAddNode }: ContextMenuProps) {
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    onAddNode(key)
    onClose()
  }

  return (
    <div 
      className={styles.contextMenu} 
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <Menu
        items={menuItems}
        onClick={handleMenuClick}
        className={styles.menu}
      />
    </div>
  )
}

export const ContextMenu = memo(ContextMenuComponent)


