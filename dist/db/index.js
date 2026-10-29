import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";
dotenv.config();
const connectionString = process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/flatmates";
// Single pooled client across serverless invocations
const { Pool } = pg;
export const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")
        ? { rejectUnauthorized: false }
        : false,
});
export const db = drizzle(pool, { schema });
export * from "./schema.js";
//# sourceMappingURL=index.js.map