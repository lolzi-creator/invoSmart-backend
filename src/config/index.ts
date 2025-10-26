import dotenv from 'dotenv'

dotenv.config()

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  
  // Email (Resend)
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    fromEmail: 'onboarding@resend.dev', // Using Resend's verified domain
    fromName: process.env.FROM_NAME || 'invoSmart'
  },
  
  // Rate Limiting - Disabled for development
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '999999') // Effectively disabled
  },
  
  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001']
  },
  
  // Swiss specific
  swiss: {
    defaultCountry: 'CH',
    supportedLanguages: ['de', 'fr', 'it', 'en'],
    defaultLanguage: 'de',
    vatRates: {
      standard: 7.7,
      reduced: 2.5,
      exempt: 0
    }
  }
}

// Validate required environment variables
export function validateConfig() {
  const required = [
    'JWT_SECRET'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

export default config
