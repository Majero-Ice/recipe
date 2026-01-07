import { useAppSelector } from '@/shared/lib/redux/hooks'
import { MacronutrientsChart } from '@/features/nutrition-charts'
import { CaloriesChart } from '@/features/nutrition-charts'
import { DetailedNutritionChart } from '@/features/nutrition-charts'
import styles from './stats-page.module.scss'

export function StatsPage() {
  const nutritionalInfo = useAppSelector((state) => state.recipe.nutritionalInfo)

  if (!nutritionalInfo) {
    return (
      <div className={styles.emptyState}>
        <p>Нет данных о пищевой ценности</p>
        <p className={styles.emptyStateSubtext}>Сгенерируйте рецепт, чтобы увидеть графики</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Пищевая ценность</h2>
      </div>
      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <CaloriesChart nutritionalInfo={nutritionalInfo} />
        </div>
        <div className={styles.chartCard}>
          <MacronutrientsChart nutritionalInfo={nutritionalInfo} />
        </div>
        <div className={styles.chartCard}>
          <DetailedNutritionChart nutritionalInfo={nutritionalInfo} />
        </div>
      </div>
    </div>
  )
}


