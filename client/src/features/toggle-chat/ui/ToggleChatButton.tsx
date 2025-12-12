import { Button } from '@/shared/ui/button/Button'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'

interface ToggleChatButtonProps {
  isOpen: boolean
  onClick: () => void
}

export function ToggleChatButton({ isOpen, onClick }: ToggleChatButtonProps) {
  return (
    <Button onClick={onClick} variant="default" icon={isOpen ? <LeftOutlined /> : <RightOutlined />} />
  )
}

