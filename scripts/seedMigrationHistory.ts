import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exitCode = 1;
    return;
  }

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const journalPath = path.join(migrationsDir, "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    console.error(`Could not find migration journal at ${journalPath}`);
    process.exitCode = 1;
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: Array<{
      tag: string;
      when: number;
    }>;
  };

  const client = postgres(DATABASE_URL, { max: 1, idle_timeout: 0 });

  try {
    await client`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        "id" serial PRIMARY KEY,
        "hash" text NOT NULL,
        "created_at" numeric
      )
    `;

    for (const entry of journal.entries) {
      const migrationFile = path.join(migrationsDir, `${entry.tag}.sql`);
      if (!fs.existsSync(migrationFile)) {
        console.warn(`Skipping ${entry.tag} because ${migrationFile} does not exist`);
        continue;
      }

      const sql = fs.readFileSync(migrationFile, "utf8");
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      const existing = await client<
        Array<{ hash: string }>
      >`SELECT "hash" FROM "__drizzle_migrations" WHERE "created_at" = ${entry.when} LIMIT 1`;

      if (existing.length > 0) {
        console.info(`Migration ${entry.tag} already recorded; skipping.`);
        continue;
      }

      await client`
        INSERT INTO "__drizzle_migrations" ("hash", "created_at")
        VALUES (${hash}, ${entry.when})
      `;
      console.info(`Recorded migration ${entry.tag} in __drizzle_migrations`);
    }

    console.info("✅ Migration journal seeded successfully");
  } catch (error) {
    console.error("❌ Failed to seed migration history");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
