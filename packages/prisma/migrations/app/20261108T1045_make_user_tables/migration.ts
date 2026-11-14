#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5aa337d6909cde16ae5414143af05b908fb4348d772eb4e075cf2a979de33bc5/contract';
import endContract from '../../snapshots/5aa337d6909cde16ae5414143af05b908fb4348d772eb4e075cf2a979de33bc5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/920a87b50729a867e21706dd0fa5c3739e273a84ed89eb2f3525633b2d6ef85c/contract';
import startContract from '../../snapshots/920a87b50729a867e21706dd0fa5c3739e273a84ed89eb2f3525633b2d6ef85c/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  lit,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'Post' }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('credentialsSetAt', 'timestamptz(3)', {
          codecRef: {
            codecId: 'pg/timestamptz-date@1',
            typeParams: { precision: 3 },
          },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('lastLoginAt', 'timestamptz(3)', {
          codecRef: {
            codecId: 'pg/timestamptz-date@1',
            typeParams: { precision: 3 },
          },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('passwordHash', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('role', 'text', {
          notNull: true,
          default: lit('STUDENT'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      // Existing rows get a random, unique googleId: Postgres evaluates the
      // volatile default once per row. The default is dropped afterwards, so new
      // rows must still provide a real googleId.
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'User',
        column: 'googleId',
        type: 'text',
        temporaryDefault: sql`gen_random_uuid()::text`,
      }),
      this.setNotNull({ schema: 'public', table: 'User', column: 'name' }),
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'User',
        column: 'avatarUrl',
        type: 'text',
        temporaryDefault: sql`''`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'User_role_check_b921956f',
        expression: sql`"role" IN ('STUDENT', 'TEACHER')`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_googleId_key',
        columns: ['googleId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_username_key',
        columns: ['username'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
