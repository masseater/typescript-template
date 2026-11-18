import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import { authRelations } from "./generated/auth.table";

export const db = drizzle(env.DB, { relations: authRelations });
