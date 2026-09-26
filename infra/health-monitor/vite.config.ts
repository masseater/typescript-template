import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const healthMonitorVite = monitorWorkerVite(import.meta.dirname);

export default defineConfig({
  ...healthMonitorVite,
});
