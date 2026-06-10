import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()] as any,
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/integration/**',
      '**/*.e2e.spec.ts',
      // xss-protection and sql-injection require a live PostgreSQL DB — routed to
      // vitest.integration.config.ts and the CI `security-integration` job.
      'tests/security/xss-protection.test.ts',
      'tests/security/sql-injection.test.ts',
      // Performance tests require live Lighthouse CI. Run separately.
      'tests/performance/**',
      // A11y tests require live browser/Playwright. Run separately.
      'tests/a11y/**',
      // account-lockout tests require full NextAuth + bcryptjs mock integration
      // which conflicts with Vitest's CJS/ESM interop for these modules.
      // Run separately via: yarn test:run src/lib/__tests__/account-lockout.test.ts
      'src/lib/__tests__/account-lockout.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'tests/', '**/*.config.{ts,js}', '**/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
