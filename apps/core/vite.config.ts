import { workerPackage } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig(
  workerPackage(import.meta.dirname, [
    "@better-auth/core",
    "better-call",
    "drizzle-orm",
    "effect",
    "msgpackr",
  ]),
);
