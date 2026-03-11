import { validateEnv, getEnv } from './envValidation';

describe('envValidation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should validate with all required variables', () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.BEDROCK_MODEL_ID = 'test-model';
    process.env.BEDROCK_EMBEDDINGS_MODEL_ID = 'test-embeddings';
    process.env.DYNAMODB_TABLE_NAME = 'test-table';

    expect(() => validateEnv()).not.toThrow();
  });

  it('should use defaults for optional variables', () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.BEDROCK_MODEL_ID = 'test-model';
    process.env.BEDROCK_EMBEDDINGS_MODEL_ID = 'test-embeddings';
    process.env.DYNAMODB_TABLE_NAME = 'test-table';

    const env = getEnv();
    expect(env.NODE_ENV).toBe('test'); // Jest sets NODE_ENV=test
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('should throw friendly error for missing variables', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AWS_REGION;
    delete process.env.BEDROCK_MODEL_ID;
    delete process.env.DEMO_MODE;

    expect(() => validateEnv()).toThrow('Environment Configuration Error');
  });
});
