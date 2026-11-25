import type { ApiOkResponse } from '@nestjs/swagger';

/** OpenAPI schema type (not exported by @nestjs/swagger, so taken from its decorator). */
export type SchemaObject = NonNullable<
  Extract<Parameters<typeof ApiOkResponse>[0], { schema?: unknown }>['schema']
>;

/** OpenAPI schema of a `User` (interfaces have no runtime shape for Swagger to read). */
export const USER_RESPONSE_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'id',
    'email',
    'name',
    'username',
    'avatarUrl',
    'role',
    'credentialsSetAt',
  ],
  properties: {
    id: { type: 'integer', example: 1 },
    email: { type: 'string', example: 's6601012345678@email.kmutnb.ac.th' },
    name: { type: 'string', example: 'Somchai K.' },
    username: { type: 'string', nullable: true, example: 'somchai_k' },
    avatarUrl: {
      type: 'string',
      example: 'https://lh3.googleusercontent.com/…',
    },
    role: { type: 'string', enum: ['STUDENT', 'TEACHER'] },
    credentialsSetAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      example: '2026-11-08T10:45:00.000Z',
    },
  },
};
