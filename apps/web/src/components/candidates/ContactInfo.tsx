'use client'

import { Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface Contact {
  fullName: string | null
  email: string | null
  phone: string | null
  location: string | null
  linkedIn: string | null
  github: string | null
  portfolio: string | null
}

interface ContactInfoProps {
  contact: Contact | null
}

export function ContactInfo({ contact }: ContactInfoProps) {
  const t = useTranslations('contact')

  if (!contact) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-muted-foreground">{t('noInfo')}</p>
        </CardContent>
      </Card>
    )
  }

  // Get initials for avatar fallback
  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl font-bold text-primary">
                {getInitials(contact.fullName || contact.email)}
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold">
                {contact.fullName || contact.email || t('candidate')}
              </h1>
              <Badge variant="secondary" className="mt-2">
                {t('candidate')}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              {/* Email */}
              {contact.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${contact.email}`} className="hover:text-primary">
                    {contact.email}
                  </a>
                </div>
              )}

              {/* Phone */}
              {contact.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${contact.phone}`} className="hover:text-primary">
                    {contact.phone}
                  </a>
                </div>
              )}

              {/* Location */}
              {contact.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{contact.location}</span>
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap gap-2">
              {contact.linkedIn && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={contact.linkedIn} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="mr-2 h-4 w-4" />
                    LinkedIn
                  </Link>
                </Button>
              )}

              {contact.github && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={contact.github} target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </Link>
                </Button>
              )}

              {contact.portfolio && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={contact.portfolio} target="_blank" rel="noopener noreferrer">
                    <Globe className="mr-2 h-4 w-4" />
                    {t('portfolio')}
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-shrink-0 flex-col gap-2">
            {contact.email && (
              <Button asChild>
                <a href={`mailto:${contact.email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  {t('sendEmail')}
                </a>
              </Button>
            )}
            {contact.phone && (
              <Button variant="outline">
                <Phone className="mr-2 h-4 w-4" />
                {t('contact')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
