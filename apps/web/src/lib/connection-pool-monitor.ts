/**
 * Connection Pool Monitoring
 * Utilities for tracking database connection pool health
 */

import { prisma } from '@/lib/prisma'
import { logger } from './logger'

export interface ConnectionPoolMetrics {
  active: number
  idle: number
  waiting: number
  maxConnections: number
  available: number
  utilizationPercent: number
  isHealthy: boolean
}

export interface ConnectionStats {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  maxConnections: number
  applicationConnections: number
  otherConnections: number
}

/**
 * Get current connection pool metrics
 * @returns Connection pool metrics
 */
export async function getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
  try {
    const result = await prisma.$queryRaw<
      Array<{
        active: bigint
        idle: bigint
        waiting: bigint
        max_connections: string
      }>
    >`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = current_database()) as active,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle' AND datname = current_database()) as idle,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL AND datname = current_database()) as waiting,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
    `

    const metrics = result[0]
    const active = Number(metrics.active)
    const idle = Number(metrics.idle)
    const waiting = Number(metrics.waiting)
    const maxConnections = parseInt(metrics.max_connections, 10)
    const total = active + idle
    const available = maxConnections - total
    const utilizationPercent = (total / maxConnections) * 100

    // Health check: pool is healthy if utilization < 80%
    const isHealthy = utilizationPercent < 80

    return {
      active,
      idle,
      waiting,
      maxConnections,
      available,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      isHealthy,
    }
  } catch (error) {
    logger.error('Failed to get connection pool metrics:', error)
    throw error
  }
}

/**
 * Get detailed connection statistics
 * @returns Detailed connection stats
 */
export async function getConnectionStats(): Promise<ConnectionStats> {
  try {
    const result = await prisma.$queryRaw<
      Array<{
        total: bigint
        active: bigint
        idle: bigint
        max_connections: string
        app_connections: bigint
        other_connections: bigint
      }>
    >`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as total,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = current_database()) as active,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle' AND datname = current_database()) as idle,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '%prisma%' AND datname = current_database()) as app_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE application_name NOT LIKE '%prisma%' AND datname = current_database()) as other_connections
    `

    const stats = result[0]

    return {
      totalConnections: Number(stats.total),
      activeConnections: Number(stats.active),
      idleConnections: Number(stats.idle),
      maxConnections: parseInt(stats.max_connections, 10),
      applicationConnections: Number(stats.app_connections),
      otherConnections: Number(stats.other_connections),
    }
  } catch (error) {
    logger.error('Failed to get connection stats:', error)
    throw error
  }
}

/**
 * Get long-running queries that may be holding connections
 * @param thresholdSeconds Minimum duration in seconds (default: 5)
 * @returns Array of long-running queries
 */
export async function getLongRunningQueries(thresholdSeconds: number = 5) {
  try {
    const result = await prisma.$queryRaw<
      Array<{
        pid: number
        duration: string
        query: string
        state: string
        application_name: string
      }>
    >`
      SELECT
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query,
        state,
        application_name
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '${thresholdSeconds} seconds'
        AND datname = current_database()
        AND state != 'idle'
      ORDER BY duration DESC
      LIMIT 10
    `

    return result
  } catch (error) {
    logger.error('Failed to get long-running queries:', error)
    throw error
  }
}

/**
 * Check if connection pool is exhausted
 * @param warningThreshold Utilization % to trigger warning (default: 80)
 * @returns True if pool is approaching exhaustion
 */
export async function isPoolExhausted(warningThreshold: number = 80): Promise<boolean> {
  const metrics = await getConnectionPoolMetrics()
  return metrics.utilizationPercent >= warningThreshold
}

/**
 * Get connection pool health status
 * @returns Health status object
 */
export async function getPoolHealth() {
  const metrics = await getConnectionPoolMetrics()
  const longQueries = await getLongRunningQueries()

  let status: 'healthy' | 'warning' | 'critical'
  let message: string

  if (metrics.utilizationPercent < 70) {
    status = 'healthy'
    message = 'Connection pool is operating normally'
  } else if (metrics.utilizationPercent < 85) {
    status = 'warning'
    message = 'Connection pool utilization is high'
  } else {
    status = 'critical'
    message = 'Connection pool is near exhaustion'
  }

  return {
    status,
    message,
    metrics,
    longRunningQueries: longQueries.length,
    recommendations: getRecommendations(metrics, longQueries.length),
  }
}

/**
 * Get recommendations based on pool health
 */
function getRecommendations(metrics: ConnectionPoolMetrics, longQueriesCount: number): string[] {
  const recommendations: string[] = []

  if (metrics.utilizationPercent > 80) {
    recommendations.push('Consider increasing connection_limit in DATABASE_URL')
    recommendations.push('Review and optimize slow queries')
  }

  if (longQueriesCount > 5) {
    recommendations.push('Multiple long-running queries detected - investigate performance')
    recommendations.push('Consider implementing query timeouts (see QUERY_TIMEOUT_POLICY.md)')
  }

  if (metrics.waiting > 0) {
    recommendations.push(
      'Connections are waiting for resources - possible deadlock or long transactions',
    )
  }

  if (metrics.available < 10) {
    recommendations.push('Very few connections available - risk of connection exhaustion')
  }

  if (recommendations.length === 0) {
    recommendations.push('Connection pool is healthy - no action needed')
  }

  return recommendations
}

/**
 * Kill a specific connection by PID (USE WITH CAUTION)
 * @param pid Process ID to terminate
 */
export async function killConnection(pid: number): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT pg_terminate_backend(${pid});`
    logger.info(`Terminated connection with PID ${pid}`)
  } catch (error) {
    logger.error(`Failed to kill connection ${pid}:`, error)
    throw error
  }
}

/**
 * Log connection pool metrics
 * Use this in production for monitoring
 */
export async function logConnectionMetrics(): Promise<void> {
  try {
    const metrics = await getConnectionPoolMetrics()
    logger.info('Connection Pool Metrics:', {
      active: metrics.active,
      idle: metrics.idle,
      waiting: metrics.waiting,
      available: metrics.available,
      utilizationPercent: `${metrics.utilizationPercent}%`,
      status: metrics.isHealthy ? 'healthy' : 'unhealthy',
    })
  } catch (error) {
    logger.error('Failed to log connection metrics:', error)
  }
}

/**
 * Periodic connection pool monitoring
 * Call this in a scheduled job (e.g., every 5 minutes)
 */
export async function monitorConnectionPool(): Promise<void> {
  const health = await getPoolHealth()

  if (health.status === 'critical') {
    logger.error('🚨 CRITICAL: Connection pool near exhaustion!', health)
    // Send alert to Sentry/monitoring system
  } else if (health.status === 'warning') {
    logger.warn('⚠️  WARNING: Connection pool utilization high', health)
  } else {
    logger.info('✅ Connection pool healthy', {
      utilization: `${health.metrics.utilizationPercent}%`,
      available: health.metrics.available,
    })
  }
}

// Example usage:
// Schedule this to run every 5 minutes
// setInterval(monitorConnectionPool, 5 * 60 * 1000)
