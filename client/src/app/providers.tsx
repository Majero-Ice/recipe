import { type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { ReactFlowProvider } from '@xyflow/react'
import { Provider } from 'react-redux'
import { store } from './store'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Provider store={store}>
      <ConfigProvider>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </ConfigProvider>
    </Provider>
  )
}

