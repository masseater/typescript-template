import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/shared/db/client.server";

import * as schema from "./generated/auth.table";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true },
  plugins: [tanstackStartCookies()],
});
