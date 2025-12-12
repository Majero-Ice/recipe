import { Card, Typography, List } from 'antd'
import { ShoppingOutlined, ScissorOutlined, FireOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { RecipeBlockType, type RecipeBlock } from '@/shared/api/chat/types'
import styles from './recipeBlock.module.scss'

const { Text } = Typography

interface RecipeBlockProps {
  block: RecipeBlock
}

const blockConfig: Record<RecipeBlockType, {
  icon: React.ReactNode
  borderColor: string
  backgroundColor: string
  hoverBorderColor: string
  shadowColor: string
  iconGradient: string
}> = {
  [RecipeBlockType.INGREDIENTS]: {
    icon: <ShoppingOutlined />,
    borderColor: '#52c41a',
    backgroundColor: '#f6ffed',
    hoverBorderColor: '#73d13d',
    shadowColor: 'rgba(82, 196, 26, 0.2)',
    iconGradient: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
  },
  [RecipeBlockType.PREPARATION]: {
    icon: <ScissorOutlined />,
    borderColor: '#faad14',
    backgroundColor: '#fffbe6',
    hoverBorderColor: '#ffc53d',
    shadowColor: 'rgba(250, 173, 20, 0.2)',
    iconGradient: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
  },
  [RecipeBlockType.COOKING]: {
    icon: <FireOutlined />,
    borderColor: '#ff4d4f',
    backgroundColor: '#fff1f0',
    hoverBorderColor: '#ff7875',
    shadowColor: 'rgba(255, 77, 79, 0.2)',
    iconGradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
  },
  [RecipeBlockType.SERVING]: {
    icon: <CheckCircleOutlined />,
    borderColor: '#1890ff',
    backgroundColor: '#e6f7ff',
    hoverBorderColor: '#40a9ff',
    shadowColor: 'rgba(24, 144, 255, 0.2)',
    iconGradient: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
  },
}

export function RecipeBlockComponent({ block }: RecipeBlockProps) {
  const config = blockConfig[block.type]
  
  // Parse ingredients into list items if it's an ingredients block
  const isIngredientsBlock = block.type === RecipeBlockType.INGREDIENTS
  const ingredientItems = isIngredientsBlock
    ? block.content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          // Try to parse "item - quantity" or "item: quantity" format
          const match = line.match(/^[-•*]\s*(.+?)(?:\s*[-–—:：]\s*(.+))?$/i)
          if (match) {
            return {
              name: match[1].trim(),
              quantity: match[2]?.trim() || '',
            }
          }
          // If no match, treat whole line as name
          return {
            name: line.replace(/^[-•*]\s*/, '').trim(),
            quantity: '',
          }
        })
    : []

  return (
    <Card
      className={styles.recipeBlock}
      size="small"
      style={{
        borderColor: config.borderColor,
        backgroundColor: config.backgroundColor,
        boxShadow: `0 2px 8px ${config.shadowColor}`,
      }}
    >
      <div className={styles.blockContent}>
        {config.icon && (
          <div
            className={styles.icon}
            style={{
              background: config.iconGradient,
            }}
          >
            {config.icon}
          </div>
        )}
        <div className={styles.textContent}>
          {block.title && (
            <Text strong className={styles.title}>
              {block.title}
            </Text>
          )}
          {isIngredientsBlock && ingredientItems.length > 0 ? (
            <List
              size="small"
              dataSource={ingredientItems}
              renderItem={(item) => (
                <List.Item className={styles.ingredientItem}>
                  <Text className={styles.ingredientName}>{item.name}</Text>
                  {item.quantity && (
                    <Text className={styles.ingredientQuantity}>{item.quantity}</Text>
                  )}
                </List.Item>
              )}
            />
          ) : (
            <Text className={styles.content}>{block.content}</Text>
          )}
        </div>
      </div>
    </Card>
  )
}

