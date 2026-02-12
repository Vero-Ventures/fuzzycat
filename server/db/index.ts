import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

let _db: ReturnType<typeof createDb> | undefined;

/**
 * A lazy-initialized database instance using a Proxy.
 * This prevents a database connection from being established during build time
 * (e.g., `next build`) when environment variables might not be available.
 * The connection is only created on the first access to the `db` object.
 */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!_db) {
      _db = createDb();
    }
    return Reflect.get(_db, prop);
  },
});
