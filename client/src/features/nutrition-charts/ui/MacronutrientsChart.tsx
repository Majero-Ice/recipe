import { useMemo } from 'react'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { NutritionalInfo } from '@/shared/api/recipe-flow/types'

interface MacronutrientsChartProps {
  nutritionalInfo: NutritionalInfo
}

export function MacronutrientsChart({ nutritionalInfo }: MacronutrientsChartProps) {
  const chartOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        toolbar: {
          show: false,
        },
      },
      labels: ['Protein', 'Fat', 'Carbohydrates'],
      colors: ['#3b82f6', '#ef4444', '#f59e0b'],
      legend: {
        position: 'bottom',
        fontSize: '14px',
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
      tooltip: {
        y: {
          formatter: (val: number) => `${val.toFixed(1)} g`,
        },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '16px',
                fontWeight: 600,
              },
              value: {
                show: true,
                fontSize: '24px',
                fontWeight: 700,
                formatter: (val: string) => `${val} g`,
              },
              total: {
                show: true,
                label: 'Total',
                fontSize: '16px',
                fontWeight: 600,
                formatter: () => {
                  const total = nutritionalInfo.protein + nutritionalInfo.fat + nutritionalInfo.carbohydrates
                  return `${total.toFixed(1)} g`
                },
              },
            },
          },
        },
      },
    }),
    [nutritionalInfo],
  )

  const chartSeries = useMemo(
    () => [nutritionalInfo.protein, nutritionalInfo.fat, nutritionalInfo.carbohydrates],
    [nutritionalInfo],
  )

  return (
    <div>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Macronutrients</h3>
      <Chart options={chartOptions} series={chartSeries} type="donut" height={350} />
    </div>
  )
}



