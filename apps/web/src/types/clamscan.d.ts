/**
 * Type definitions for clamscan
 * ClamAV antivirus library for Node.js
 */

declare module 'clamscan' {
  export interface ClamScanOptions {
    clamdscan?: {
      host?: string
      port?: number
      timeout?: number
      local_fallback?: boolean
    }
    preference?: 'clamdscan' | 'clamscan'
    debug_mode?: boolean
  }

  export interface ScanResult {
    isInfected: boolean
    viruses: string[]
    file?: string
  }

  export default class NodeClam {
    constructor()
    init(options: ClamScanOptions): Promise<{
      scanStream: (buffer: Buffer) => Promise<ScanResult>
      scanFile: (path: string) => Promise<ScanResult>
      isInfected: (path: string) => Promise<ScanResult>
    }>
  }
}
