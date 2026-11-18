import type { SchemaObject } from './swagger.constants';

/** OpenAPI schema of an error body with a machine-readable `code`. */
export const errorSchema = (code: string): SchemaObject => ({
  type: 'object',
  properties: {
    code: { type: 'string', example: code },
    message: { type: 'string' },
  },
});
