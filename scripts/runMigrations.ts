import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    process.exitCode = 1;
    return;
  }

  const client = postgres(connectionString, { max: 1, idle_timeout: 0 });
  const db = drizzle(client);

  try {
    console.info("Running database migrations from ./migrations");
    const start = Date.now();
    await migrate(db, { migrationsFolder: "./migrations" });
    const elapsed = Date.now() - start;
    console.info(`✅ Migrations applied successfully in ${elapsed}ms`);
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
