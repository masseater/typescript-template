import { evaluateBudget } from "./decision.ts";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";

try {
  // oxlint-disable-next-line node/no-process-env
  const config = parseBudgetConfig(process.env);
  const usage = await fetchUsage(
    config.CLOUDFLARE_ACCOUNT_ID,
    config.BILLING_READ_TOKEN,
    new Date(),
  );
  process.stdout.write(
    `${JSON.stringify({ event: "budget.inspected", ...evaluateBudget(usage, config) })}\n`,
  );
} catch {
  process.stderr.write(`${JSON.stringify({ event: "budget.inspect_failed" })}\n`);
  process.exitCode = 1;
}
