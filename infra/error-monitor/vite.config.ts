import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(monitorWorkerVite("error-monitor"));
