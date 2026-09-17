import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings, Notify } from "@template/monitor";
import { decideNotifications, formatMessage } from "./decision.ts";
import type { SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";
import { parseErrorMonitorConfig } from "./config.ts";

interface Bindings extends MonitorBindings {
  readonly CLOUDFLARE_ACCOUNT_ID: string;
  readonly OBSERVABILITY_TOKEN: string;
}

interface ErrorCheck {
  readonly groups: number;
  readonly notified: number;
}

const LOOKBACK_MS = 900_000;

class ErrorMonitor extends Monitor<Bindings> {
  protected readonly event = "error_monitor";
  protected readonly failure = {
    subject: "Cloudflare Workers error monitoring failed",
    text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
  };

  protected async check(notify: Notify): Promise<ErrorCheck> {
    const config = parseErrorMonitorConfig(this.env);
    const now = Date.now();
    const groups = await fetchErrorGroups({
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      from: now - LOOKBACK_MS,
      to: now,
      token: config.OBSERVABILITY_TOKEN,
    });
    const seen = (await this.ctx.storage.get<SeenFingerprints>("seen")) ?? {};
    const decision = decideNotifications(groups, seen, now);
    if (decision.notifications.length > 0) {
      await notify({
        subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
        text: formatMessage(decision.notifications),
      });
    }
    await this.ctx.storage.put("seen", decision.seen);
    return { groups: groups.length, notified: decision.notifications.length };
  }
}

export { ErrorMonitor };

// oxlint-disable-next-line import/no-default-export
export default monitorHandler("error_monitor");
