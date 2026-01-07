import { memo } from 'react'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import { 
  AppstoreOutlined, 
  ShoppingOutlined, 
  ExperimentOutlined, 
  FireOutlined, 
  CheckCircleOutlined 
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
    key: 'defaultNode',
    icon: <AppstoreOutlined />,
    label: 'Обычный узел',
  },
  {
    key: 'ingredientNode',
    icon: <ShoppingOutlined />,
    label: 'Ингредиенты',
  },
  {
    key: 'preparationNode',
    icon: <ExperimentOutlined />,
    label: 'Подготовка',
  },
  {
    key: 'cookingNode',
    icon: <FireOutlined />,
    label: 'Приготовление',
  },
  {
    key: 'servingNode',
    icon: <CheckCircleOutlined />,
    label: 'Подача',
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

