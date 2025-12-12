import { type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { ReactFlowProvider } from '@xyflow/react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ConfigProvider>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </ConfigProvider>
  )
}

