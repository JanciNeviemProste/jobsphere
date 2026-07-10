import type { Metadata } from 'next'
import CvsClient from './cvs-client'

export const metadata: Metadata = {
  title: 'My CVs',
}

export default function MyCvsPage() {
  return <CvsClient />
}
