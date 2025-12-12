import { Button as AntButton } from 'antd'
import type { ButtonProps as AntButtonProps } from 'antd'

interface ButtonProps extends Omit<AntButtonProps, 'variant'> {
  variant?: 'primary' | 'default'
}

export function Button({ variant = 'primary', type = variant === 'primary' ? 'primary' : 'default', ...props }: ButtonProps) {
  return <AntButton type={type} {...props} />
}

