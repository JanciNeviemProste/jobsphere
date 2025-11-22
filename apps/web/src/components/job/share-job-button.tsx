'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Share2, Copy, Mail, MessageCircle, Linkedin, Check } from 'lucide-react'
import { showToast } from '@/components/ui/use-toast'

interface ShareJobButtonProps {
  jobId: string
  jobTitle: string
  companyName: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function ShareJobButton({
  jobId,
  jobTitle,
  companyName,
  variant = 'outline',
  size = 'lg',
  className
}: ShareJobButtonProps) {
  const [copied, setCopied] = useState(false)

  const jobUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/jobs/${jobId}`
    : ''

  const shareText = `${jobTitle} at ${companyName}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl)
      setCopied(true)
      showToast({
        title: 'Odkaz skopírovaný',
        description: 'Odkaz na prácu bol skopírovaný do schránky.'
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast({
        title: 'Chyba',
        description: 'Nepodarilo sa skopírovať odkaz.',
        variant: 'destructive'
      })
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: `Pozri si túto pracovnú ponuku: ${shareText}`,
          url: jobUrl
        })
      } catch (error) {
        // User cancelled or error - ignore
        if ((error as Error).name !== 'AbortError') {
          console.warn('Share failed:', error)
        }
      }
    }
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Pracovná ponuka: ${shareText}`)
    const body = encodeURIComponent(`Pozri si túto pracovnú ponuku:\n\n${shareText}\n\n${jobUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const shareViaLinkedIn = () => {
    const url = encodeURIComponent(jobUrl)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400')
  }

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Pozri si túto pracovnú ponuku: ${shareText}\n${jobUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  // Use native share on mobile if available
  const canUseNativeShare = typeof navigator !== 'undefined' && navigator.share

  if (canUseNativeShare) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleNativeShare}
        className={className}
        aria-label="Zdieľať prácu"
      >
        <Share2 className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label="Zdieľať prácu"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          Kopírovať odkaz
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareViaEmail}>
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareViaLinkedIn}>
          <Linkedin className="mr-2 h-4 w-4" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareViaWhatsApp}>
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
