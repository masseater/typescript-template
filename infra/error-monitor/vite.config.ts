import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(monitorWorkerVite());
