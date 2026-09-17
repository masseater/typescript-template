import { defineConfig } from "drizzle-kit";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  dialect: "sqlite",
  out: "./migrations",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
