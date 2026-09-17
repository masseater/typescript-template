import { D1Database } from "@pulumi/cloudflare";
import { consumeSettings } from "./reference.ts";

const { settings } = await consumeSettings("database", "settings");
const database = new D1Database(
  "database",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-db`,
  },
  { protect: true },
);

const databaseId = database.id;

export { databaseId };
