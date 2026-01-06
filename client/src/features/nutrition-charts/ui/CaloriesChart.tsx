import { useMemo } from 'react'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { NutritionalInfo } from '@/shared/api/recipe-flow/types'

interface CaloriesChartProps {
  nutritionalInfo: NutritionalInfo
}

export function CaloriesChart({ nutritionalInfo }: CaloriesChartProps) {
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
          horizontal: false,
          columnWidth: '60%',
          borderRadius: 4,
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val} ккал`,
      },
      xaxis: {
        categories: ['Калории'],
        labels: {
          style: {
            fontSize: '14px',
          },
        },
      },
      yaxis: {
        title: {
          text: 'ккал',
          style: {
            fontSize: '14px',
          },
        },
        labels: {
          formatter: (val: number) => `${val}`,
        },
      },
      colors: ['#10b981'],
      tooltip: {
        y: {
          formatter: (val: number) => `${val} ккал`,
        },
      },
      grid: {
        show: true,
        borderColor: '#e5e7eb',
        strokeDashArray: 4,
      },
    }),
    [],
  )

  const chartSeries = useMemo(
    () => [
      {
        name: 'Калории',
        data: [nutritionalInfo.calories],
      },
    ],
    [nutritionalInfo],
  )

  return (
    <div>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Калории</h3>
      <Chart options={chartOptions} series={chartSeries} type="bar" height={300} />
    </div>
  )
}

