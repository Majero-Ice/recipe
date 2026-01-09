import { useMemo } from 'react'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { NutritionalInfo } from '@/shared/api/recipe-flow/types'

interface DetailedNutritionChartProps {
  nutritionalInfo: NutritionalInfo
}

export function DetailedNutritionChart({ nutritionalInfo }: DetailedNutritionChartProps) {
  const categories = useMemo(() => {
    const cats: string[] = ['Protein', 'Fat', 'Carbohydrates']
    if (nutritionalInfo.fiber !== undefined) cats.push('Fiber')
    if (nutritionalInfo.sugar !== undefined) cats.push('Sugar')
    if (nutritionalInfo.sodium !== undefined) cats.push('Sodium')
    return cats
  }, [nutritionalInfo])

  const values = useMemo(() => {
    const vals: number[] = [
      nutritionalInfo.protein,
      nutritionalInfo.fat,
      nutritionalInfo.carbohydrates,
    ]
    if (nutritionalInfo.fiber !== undefined) vals.push(nutritionalInfo.fiber)
    if (nutritionalInfo.sugar !== undefined) vals.push(nutritionalInfo.sugar)
    if (nutritionalInfo.sodium !== undefined) vals.push(nutritionalInfo.sodium) // Sodium in milligrams
    return vals
  }, [nutritionalInfo])

  const units = useMemo(() => {
    const unitsList: string[] = ['g', 'g', 'g']
    if (nutritionalInfo.fiber !== undefined) unitsList.push('g')
    if (nutritionalInfo.sugar !== undefined) unitsList.push('g')
    if (nutritionalInfo.sodium !== undefined) unitsList.push('mg')
    return unitsList
  }, [nutritionalInfo])

  const chartOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        toolbar: {
          show: false,
        },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%',
          borderRadius: 4,
          distributed: true,
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts: any) => {
          const index = opts.dataPointIndex
          const unit = units[index]
          return `${val.toFixed(1)} ${unit}`
        },
      },
      xaxis: {
        categories: categories,
        labels: {
          style: {
            fontSize: '14px',
          },
        },
      },
      yaxis: {
        labels: {
          style: {
            fontSize: '14px',
          },
        },
      },
      colors: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'],
      tooltip: {
        y: {
          formatter: (val: number, opts: any) => {
            const index = opts.dataPointIndex
            const unit = units[index]
            return `${val.toFixed(1)} ${unit}`
          },
        },
      },
      grid: {
        show: true,
        borderColor: '#e5e7eb',
        strokeDashArray: 4,
      },
    }),
    [categories, units],
  )

  const chartSeries = useMemo(
    () => [
      {
        name: 'Value',
        data: values,
      },
    ],
    [values],
  )

  return (
    <div>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Detailed Information</h3>
      <Chart options={chartOptions} series={chartSeries} type="bar" height={Math.max(300, categories.length * 60)} />
    </div>
  )
}

