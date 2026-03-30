import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()] as any,
  test: {
    environment: 'happy-dom',
    setupFiles: ['./apps/web/tests/setup.ts', './apps/web/tests/integration/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
      '**/*.e2e.spec.ts',
      '**/tests/a11y/**',
      '**/tests/performance/**',
      '**/tests/security/**',
      '**/tests/integration/**',
    ],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@jobsphere/ai': path.resolve(__dirname, './packages/ai/src/index.ts'),
      '@jobsphere/db': path.resolve(__dirname, './packages/db/src/index.ts'),
      resend: path.resolve(__dirname, './apps/web/tests/__mocks__/resend.ts'),
      '@sendgrid/mail': path.resolve(__dirname, './apps/web/tests/__mocks__/@sendgrid/mail.ts'),
    },
  },
})
