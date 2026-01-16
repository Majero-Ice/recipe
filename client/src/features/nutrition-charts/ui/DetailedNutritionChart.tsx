import { useMemo } from 'react'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { NutritionalInfo } from '@/shared/api/recipe-flow/types'

interface DetailedNutritionChartProps {
  nutritionalInfo: NutritionalInfo
}

export function DetailedNutritionChart({ nutritionalInfo }: DetailedNutritionChartProps) {
  const labels = useMemo(() => {
    const labs: string[] = ['Protein', 'Fat', 'Carbohydrates']
    if (nutritionalInfo.fiber !== undefined) labs.push('Fiber')
    if (nutritionalInfo.sugar !== undefined) labs.push('Sugar')
    if (nutritionalInfo.sodium !== undefined) labs.push('Sodium')
    return labs
  }, [nutritionalInfo])

  // Store original values with their units for display
  const originalValues = useMemo(() => {
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

  // Convert all values to grams for proper bar chart scale
  // Sodium is in mg, so we convert it to g (divide by 1000)
  const values = useMemo(() => {
    return originalValues.map((val, index) => {
      if (units[index] === 'mg') {
        return val / 1000 // Convert mg to g
      }
      return val
    })
  }, [originalValues, units])

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
          distributed: true,
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts: any) => {
          const index = opts.dataPointIndex
          // Hide labels on small bars (less than 5% of max value)
          const maxValue = Math.max(...values)
          if (val < maxValue * 0.05) {
            return ''
          }
          const unit = units[index] || 'g'
          // Use original value for display (not converted to grams)
          const originalValue = originalValues[index]
          return `${originalValue.toFixed(1)} ${unit}`
        },
      },
      xaxis: {
        categories: labels,
      },
      yaxis: {
        title: {
          text: 'Amount',
        },
      },
      colors: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'],
      tooltip: {
        y: {
          formatter: (_val: number, opts: any) => {
            const index = opts.dataPointIndex
            const unit = units[index] || 'g'
            // Use original value for display (not converted to grams)
            const originalValue = originalValues[index]
            return `${originalValue.toFixed(1)} ${unit}`
          },
        },
      },
    }),
    [labels, units, originalValues, values],
  )


  return (
    <div>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Detailed Information</h3>
      <Chart options={chartOptions} series={[{ name: 'Amount', data: values }]} type="bar" height={350} />
    </div>
  )
}

