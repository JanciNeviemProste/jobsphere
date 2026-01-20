'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from 'lucide-react'

interface ScoreBadgeProps {
  score: number
  passingScore: number
  className?: string
}

export function ScoreBadge({ score, passingScore, className }: ScoreBadgeProps) {
  const passed = score >= passingScore
  const percentage = Math.round(score)

  return (
    <Badge variant={passed ? 'default' : 'destructive'} className={className}>
      {passed ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
      {percentage}% {passed ? 'Passed' : 'Failed'}
    </Badge>
  )
}
