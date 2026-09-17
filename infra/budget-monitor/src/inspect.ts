import { parseBudgetConfig } from "./config.ts";
import { fetchUsage } from "./billing.ts";
import { evaluateBudget } from "./decision.ts";

try {
  const config = parseBudgetConfig(process.env);
  const usage = await fetchUsage(
    config.CLOUDFLARE_ACCOUNT_ID,
    config.BILLING_READ_TOKEN,
    new Date(),
  );
  console.log(JSON.stringify({ event: "budget.inspected", ...evaluateBudget(usage, config) }));
} catch {
  console.error(JSON.stringify({ event: "budget.inspect_failed" }));
  process.exitCode = 1;
}
