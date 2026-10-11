import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema.js";

const createDatabase = () => drizzle({ schema });
let client: ReturnType<typeof createDatabase> | undefined;

export function database() {
  return client ??= createDatabase();
}
