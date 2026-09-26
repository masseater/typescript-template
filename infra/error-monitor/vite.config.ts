import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const errorMonitorVite = monitorWorkerVite(import.meta.dirname);

export default defineConfig({
  ...errorMonitorVite,
});
