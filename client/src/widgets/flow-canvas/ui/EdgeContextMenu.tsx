import { memo } from 'react'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import { ClockCircleOutlined, MinusOutlined } from '@ant-design/icons'
import styles from './edge-context-menu.module.scss'

interface EdgeContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onChangeEdgeType: (edgeType: string | undefined) => void
}

const menuItems: MenuProps['items'] = [
  {
    key: 'default',
    icon: <MinusOutlined />,
    label: 'Default Edge',
  },
  {
    key: 'timeEdge',
    icon: <ClockCircleOutlined />,
    label: 'Time Edge',
  },
]

function EdgeContextMenuComponent({ x, y, onClose, onChangeEdgeType }: EdgeContextMenuProps) {
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const edgeType = key === 'default' ? undefined : key
    onChangeEdgeType(edgeType)
    onClose()
  }

  return (
    <div 
      className={styles.edgeContextMenu} 
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

export const EdgeContextMenu = memo(EdgeContextMenuComponent)

