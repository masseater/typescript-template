import * as cloudflare from "@pulumi/cloudflare";
import { consumeSettings } from "./reference.ts";

const { settings } = await consumeSettings("database", "settings");
const database = new cloudflare.D1Database(
  "database",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-db`,
  },
  { protect: true },
);

export const databaseId = database.id;
