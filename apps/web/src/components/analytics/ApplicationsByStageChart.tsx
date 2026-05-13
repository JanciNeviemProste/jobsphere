'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STAGE_LABELS_EN } from '@/lib/constants/application-stages'

interface ApplicationsByStageChartProps {
  data: Array<{
    stage: string
    count: number
  }>
}

const COLORS = {
  NEW: '#3b82f6',
  SCREENING: '#f59e0b',
  PHONE_SCREEN: '#8b5cf6',
  INTERVIEW: '#10b981',
  OFFER: '#06b6d4',
  HIRED: '#22c55e',
  REJECTED: '#ef4444',
}

export function ApplicationsByStageChart({ data }: ApplicationsByStageChartProps) {
  const chartData = data.map((item) => ({
    name: STAGE_LABELS_EN[item.stage as keyof typeof STAGE_LABELS_EN] || item.stage,
    value: item.count,
    fill: COLORS[item.stage as keyof typeof COLORS] || '#gray',
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
