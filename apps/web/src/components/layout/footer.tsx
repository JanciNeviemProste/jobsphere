import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')

  const footerSections = [
    {
      title: t('forCandidates'),
      links: [
        { label: t('browseJobs'), href: '/jobs' },
        { label: t('createCV'), href: '/create-cv' },
        { label: t('careerAdvice'), href: '/career-advice' },
      ],
    },
    {
      title: t('forEmployers'),
      links: [
        { label: t('postJob'), href: '/post-job' },
        { label: t('pricing'), href: '/pricing' },
        { label: t('atsFeatures'), href: '/features' },
      ],
    },
    {
      title: t('company'),
      links: [
        { label: t('about'), href: '/about' },
        { label: t('contact'), href: '/contact' },
        { label: t('blog'), href: '/blog' },
      ],
    },
    {
      title: t('legal'),
      links: [
        { label: t('privacy'), href: '/privacy' },
        { label: t('terms'), href: '/terms' },
        { label: t('gdpr'), href: '/gdpr' },
      ],
    },
  ]

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          {footerSections.map((section, index) => (
            <div key={index}>
              <h3 className="mb-4 text-sm font-semibold">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-center md:text-left">
              <p className="text-2xl font-bold">
                Job<span className="text-primary">Sphere</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('tagline')}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} JobSphere. {t('allRightsReserved')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
