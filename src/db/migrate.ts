import { pool } from "./index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log("Running migrations...");
  let client;
  try {
    client = await pool.connect();
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`Applying migration ${file}...`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sqlContent);
      console.log(`Applied ${file}`);
    }
    console.log("Migrations applied successfully!");
  } catch (error: any) {
    console.error("Migration failed:", error.message || error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Connection error details:", err.message || err);
      process.exit(1);
    });
}
