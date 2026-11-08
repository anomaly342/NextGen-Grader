import 'dotenv/config';
import postgres, { type PostgresClient } from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './contract.d.ts';
import contractJson from './contract.json' with { type: 'json' };

export const contract = contractFromJson<Contract>(contractJson);

export type Db = PostgresClient<Contract>;

export const db: Db = postgres({
  contract,
  url: process.env['DATABASE_URL']!,
});
