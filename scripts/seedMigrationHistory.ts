import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";
import type { Sql } from "postgres";

type JournalEntry = {
  idx: number;
  tag: string;
  when: number;
};

type Snapshot = {
  tables: Record<
    string,
    {
      name: string;
      schema: string;
    }
  >;
};

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function getSnapshotPath(metaDir: string, idx: number) {
  const padded = idx.toString().padStart(4, "0");
  return path.join(metaDir, `${padded}_snapshot.json`);
}

async function ensureExpectedTablesExist(
  sqlClient: Sql,
  snapshot: Snapshot,
) {
  const expectedTables = Object.entries(snapshot.tables)
    .map(([fullyQualified, config]) => {
      const [schemaFromKey, nameFromKey] = fullyQualified.split(".");
      const schema = schemaFromKey || config.schema || "public";
      const name = config.name || nameFromKey;
      return { schema, name, fq: `${schema}.${name}` };
    })
    .reduce((acc, table) => {
      acc.set(table.fq, table);
      return acc;
    }, new Map<string, { schema: string; name: string; fq: string }>());

  const rows = await sqlClient<
    { table_schema: string; table_name: string }[]
  >`select table_schema, table_name from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')`;

  const present = new Set(
    rows.map((row) => `${row.table_schema}.${row.table_name}`),
  );

  const missing = Array.from(expectedTables.keys()).filter(
    (fq) => !present.has(fq),
  );

  if (missing.length > 0) {
    const formatted = missing.sort().join(", ");
    throw new Error(
      `Cannot seed migration history: expected tables missing in database: ${formatted}`,
    );
  }
}

async function main() {
  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exitCode = 1;
    return;
  }

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const metaDir = path.join(migrationsDir, "meta");
  const journalPath = path.join(metaDir, "_journal.json");

  let journal: { entries: JournalEntry[] };
  try {
    journal = await readJsonFile<{ entries: JournalEntry[] }>(journalPath);
  } catch (error) {
    console.error(`Could not read migration journal at ${journalPath}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  if (journal.entries.length === 0) {
    console.info("Journal is empty; nothing to record.");
    return;
  }

  const latestEntry = journal.entries.reduce((acc, entry) =>
    entry.idx > acc.idx ? entry : acc,
  );
  const snapshotPath = getSnapshotPath(metaDir, latestEntry.idx);

  let snapshot: Snapshot;
  try {
    snapshot = await readJsonFile<Snapshot>(snapshotPath);
  } catch (error) {
    console.error(`Failed to read snapshot at ${snapshotPath}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  const client = postgres(DATABASE_URL, { max: 1, idle_timeout: 0 });

  try {
    await ensureExpectedTablesExist(client, snapshot);

    await client`create schema if not exists "drizzle"`;
    await client`create table if not exists "drizzle"."__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at numeric
    )`;

    const existingHashes = await client<
      { hash: string }[]
    >`select hash from "drizzle"."__drizzle_migrations"`;
    const knownHashes = new Set(existingHashes.map((row) => row.hash));

    let inserted = 0;

    for (const entry of journal.entries) {
      const migrationPath = path.join(migrationsDir, `${entry.tag}.sql`);
      let migrationContents: string;

      try {
        migrationContents = await fs.readFile(migrationPath, "utf8");
      } catch (error) {
        console.error(
          `Failed to read migration file ${migrationPath}. Aborting seeding.`,
        );
        console.error(error);
        process.exitCode = 1;
        return;
      }

      const hash = crypto
        .createHash("sha256")
        .update(migrationContents)
        .digest("hex");

      if (knownHashes.has(hash)) {
        continue;
      }

      await client`
        insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
        values (${hash}, ${entry.when})
      `;
      knownHashes.add(hash);
      inserted += 1;
    }

    if (inserted === 0) {
      console.info(
        "No new migration entries were recorded; __drizzle_migrations already matches the journal.",
      );
    } else {
      console.info(
        `Recorded ${inserted} migration entr${inserted === 1 ? "y" : "ies"} in drizzle.__drizzle_migrations.`,
      );
    }
  } catch (error) {
    console.error("❌ Failed to seed migration history");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
