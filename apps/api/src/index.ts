import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { createContext } from './trpc/context'
import { appRouter } from './trpc/router'
import { prisma } from '@jobsphere/db'

// Security: Require secrets in production
function getRequiredSecret(name: string, envVar: string | undefined): string {
  if (!envVar) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} environment variable is required in production`)
    }
    console.warn(`WARNING: ${name} not set, using temporary development secret`)
    return `dev-${name.toLowerCase()}-${Date.now().toString(36)}`
  }
  return envVar
}

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  bodyLimit: 10 * 1024 * 1024, // 10MB
  trustProxy: true,
})

async function start() {
  try {
    // Security plugins
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })

    // CORS
    await server.register(cors, {
      origin: (origin, cb) => {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          process.env.NEXT_PUBLIC_APP_URL,
        ].filter(Boolean)

        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true)
        } else {
          cb(new Error('Not allowed by CORS'), false)
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    })

    // Rate limiting
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      ban: 5,
      cache: 10000,
      allowList: ['127.0.0.1'],
      redis: process.env.REDIS_URL,
      skipOnError: true,
    })

    // Cookie support - Security: require COOKIE_SECRET in production
    await server.register(cookie, {
      secret: getRequiredSecret('COOKIE_SECRET', process.env.COOKIE_SECRET),
      parseOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
    })

    // JWT - Security: require JWT_SECRET in production
    await server.register(jwt, {
      secret: getRequiredSecret('JWT_SECRET', process.env.JWT_SECRET),
      sign: {
        expiresIn: '7d',
      },
    })

    // File uploads
    await server.register(multipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 100,
        fields: 10,
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5,
        headerPairs: 2000,
      },
    })

    // OpenAPI documentation
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'JobSphere API',
          description: 'AI-powered HR ATS and Job Board Platform API',
          version: '1.0.0',
        },
        servers: [
          {
            url: process.env.API_URL || 'http://localhost:4000',
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    })

    await server.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    })

    // tRPC
    await server.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: { router: appRouter, createContext },
    })

    // Health check
    server.get('/health', async () => {
      const dbHealth = await prisma.$queryRaw`SELECT 1`
        .then(() => 'healthy')
        .catch(() => 'unhealthy')

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        uptime: process.uptime(),
      }
    })

    // Stripe webhooks
    server.post('/webhooks/stripe', {
      config: {
        rawBody: true,
      },
    }, async (request, reply) => {
      const sig = request.headers['stripe-signature']
      // Stripe webhook handling logic here
      return { received: true }
    })

    // Email webhooks
    server.post('/webhooks/email/:provider', async (request, reply) => {
      const { provider } = request.params as { provider: string }
      // Email provider webhook handling
      return { received: true, provider }
    })

    // GDPR DSAR endpoints
    server.get('/dsar/export/:userId', async (request, reply) => {
      // Data export logic
      return { message: 'Export initiated' }
    })

    server.delete('/dsar/erase/:userId', async (request, reply) => {
      // Data erasure logic
      return { message: 'Erasure initiated' }
    })

    // Start server
    const port = parseInt(process.env.PORT || '4000')
    const host = process.env.HOST || '0.0.0.0'

    await server.listen({ port, host })
    console.log(`🚀 API server running at http://${host}:${port}`)
    console.log(`📚 API documentation at http://${host}:${port}/docs`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await server.close()
  await prisma.$disconnect()
  process.exit(0)
})

start()