import { useAppDispatch, useAppSelector } from '@/shared/lib/redux/hooks'
import { setCurrentPage } from '@/entities/recipe/model/recipe.slice'
import type { PageType } from '@/entities/recipe/model/recipe.slice'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import styles from './page-navigation.module.scss'

interface PageNavigationProps {
  onNavigate: (page: PageType) => void
}

export function PageNavigation({ onNavigate }: PageNavigationProps) {
  const currentPage = useAppSelector((state) => state.recipe.currentPage)
  const nutritionalInfo = useAppSelector((state) => state.recipe.nutritionalInfo)

  const handleLeftClick = () => {
    if (currentPage === 'stats') {
      onNavigate('flow')
    }
  }

  const handleRightClick = () => {
    if (currentPage === 'flow' && nutritionalInfo) {
      onNavigate('stats')
    }
  }

  const showLeftArrow = currentPage === 'stats'
  const showRightArrow = currentPage === 'flow' && nutritionalInfo !== null

  return (
    <>
      {showLeftArrow && (
        <button className={styles.navButton} onClick={handleLeftClick} aria-label="Go to Flow">
          <LeftOutlined className={styles.icon} />
          <span className={styles.label}>Flow</span>
        </button>
      )}
      {showRightArrow && (
        <button className={styles.navButton} onClick={handleRightClick} aria-label="Go to Stats">
          <RightOutlined className={styles.icon} />
          <span className={styles.label}>Stats</span>
        </button>
      )}
    </>
  )
}



