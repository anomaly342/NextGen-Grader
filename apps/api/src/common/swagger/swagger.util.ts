import type { SchemaObject } from './swagger.constants';

/**
 * OpenAPI schema of an error body with a machine-readable `code`, plus any
 * `extraProperties` that error carries (e.g. `retryAfterSec`).
 */
export function errorSchema(
  code: string,
  extraProperties: NonNullable<SchemaObject['properties']> = {},
): SchemaObject {
  return {
    type: 'object',
    properties: {
      code: { type: 'string', example: code },
      message: { type: 'string' },
      ...extraProperties,
    },
  };
}
