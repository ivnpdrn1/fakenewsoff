/**
 * Environment Variable Validation
 *
 * Validates required environment variables on startup
 * Provides friendly error messages for missing configuration
 */

import { z } from 'zod';

const envSchema = z.object({
  // AWS Configuration (required for production, optional in test/demo)
  AWS_REGION: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Bedrock Models (required for production, optional in test/demo)
  BEDROCK_MODEL_ID: z.string().min(1).optional(),
  BEDROCK_EMBEDDINGS_MODEL_ID: z.string().min(1).optional(),

  // DynamoDB (required for production, optional in test/demo)
  DYNAMODB_TABLE_NAME: z.string().min(1).optional(),
  DYNAMODB_ENDPOINT: z.string().optional(),

  // S3 Storage (optional)
  S3_INPUT_BUCKET: z.string().optional(),
  S3_OUTPUT_BUCKET: z.string().optional(),

  // Application Settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Demo Mode
  DEMO_MODE: z.string().transform((val) => val === 'true').default('false'),
  DEMO_DELAY: z.string().optional(),
  DEMO_LOG: z.string().optional(),

  // Cache Settings
  CACHE_DISABLE: z.string().optional(),
  CACHE_TTL_HOURS: z.string().optional(),
  CACHE_MAX_SIZE: z.string().optional(),

  // Real-time News Grounding
  BING_NEWS_ENDPOINT: z.string().url().default('https://api.bing.microsoft.com/v7.0/news/search'),
  BING_NEWS_KEY: z.string().optional(),
  GDELT_DOC_ENDPOINT: z.string().url().default('https://api.gdeltproject.org/api/v2/doc/doc'),
  GROUNDING_TIMEOUT_MS: z.string().default('3500'),
  GROUNDING_CACHE_TTL_SECONDS: z.string().default('900'),
  GROUNDING_MAX_RESULTS: z.string().default('10'),
  GROUNDING_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  GROUNDING_PROVIDER_ORDER: z.string().default('bing,gdelt'),
  GROUNDING_MIN_SIMILARITY: z.string().default('0.55'),

  // Iterative Evidence Orchestration
  ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED: z.string().transform((val) => val === 'true').default('false'),

  // Internal Diagnostics
  INTERNAL_DIAGNOSTICS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 *
 * @throws Error with friendly message if validation fails
 */
export function validateEnv(): Env {
  const parsed = envSchema.parse(process.env);

  // Check for required variables in production mode
  const isProduction = parsed.NODE_ENV === 'production';
  const isDemoMode = parsed.DEMO_MODE;

  if (isProduction && !isDemoMode) {
    const requiredVars = [
      'AWS_REGION',
      'BEDROCK_MODEL_ID',
      'BEDROCK_EMBEDDINGS_MODEL_ID',
      'DYNAMODB_TABLE_NAME',
    ];

    const missing = requiredVars.filter((v) => !parsed[v as keyof Env]);

    if (missing.length > 0) {
      const message = [
        '❌ Environment Configuration Error',
        '',
        'Missing required environment variables for production:',
        ...missing.map((v) => `  - ${v}`),
        '',
        'Please create a .env file based on .env.example',
        'Or set these variables in your environment.',
        '',
        'For demo mode (no AWS credentials required):',
        '  export DEMO_MODE=true',
        '',
      ].join('\n');

      throw new Error(message);
    }
  }

  // Log warning if BING_NEWS_KEY not set (will use GDELT only)
  if (!isDemoMode && !parsed.BING_NEWS_KEY) {
    console.warn('⚠️  BING_NEWS_KEY not set - will use GDELT API only for news grounding');
  }

  return parsed;
}

/**
 * Get validated environment configuration
 */
export function getEnv(): Env {
  return validateEnv();
}
