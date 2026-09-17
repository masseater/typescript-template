import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings } from "@template/monitor";
import { parseErrorMonitorConfig } from "./config.ts";
import { decideNotifications, formatMessage } from "./decision.ts";
import type { SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";

interface Bindings extends MonitorBindings {
  CLOUDFLARE_ACCOUNT_ID: string;
  OBSERVABILITY_TOKEN: string;
}

const lookback = 15 * 60 * 1000;

export class ErrorMonitor extends Monitor<Bindings> {
  protected readonly event = "error_monitor";
  protected readonly failure = {
    subject: "Cloudflare Workers error monitoring failed",
    text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
  };

  protected async check(notify: (alert: { subject: string; text: string }) => Promise<void>) {
    const config = parseErrorMonitorConfig(this.env);
    const now = Date.now();
    const groups = await fetchErrorGroups(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.OBSERVABILITY_TOKEN,
      now - lookback,
      now,
    );
    const decision = decideNotifications(
      groups,
      (await this.ctx.storage.get<SeenFingerprints>("seen")) ?? {},
      now,
    );
    if (decision.notifications.length > 0)
      await notify({
        subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
        text: formatMessage(decision.notifications),
      });
    await this.ctx.storage.put("seen", decision.seen);
    return { groups: groups.length, notified: decision.notifications.length };
  }
}

export default monitorHandler("error_monitor");
