import {
  env,
  fetchJson,
  field,
  oidcToken,
  optionalEnv,
  run,
  stringField,
} from "../shared/runner.ts";

const AUDIENCE = "masseater-dev-ci-telemetry";
const JOBS_FILTER = `.jobs[] | select(.completed_at != null) | {id, name, conclusion, started_at, completed_at, runner_name,
  steps: [.steps[]? | select(.started_at != null and .completed_at != null)
    | {name, number, conclusion, started_at, completed_at}]}`;

const cloudflareToken = optionalEnv("CLOUDFLARE_API_TOKEN");
if (cloudflareToken === undefined) {
  console.log("::notice::Cloudflare is not configured; skipping CI telemetry");
  process.exit();
}
const account = env("CLOUDFLARE_ACCOUNT_ID");
const subdomainResponse = await fetchJson(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/subdomain`,
  { headers: { authorization: `Bearer ${cloudflareToken}` } },
);
const subdomain = stringField(field(subdomainResponse, "result"), "subdomain");
const token = await oidcToken(AUDIENCE);
const repository = env("GITHUB_REPOSITORY");
const jobs = run(
  "gh",
  [
    "api",
    "--paginate",
    `repos/${repository}/actions/runs/${env("GITHUB_RUN_ID")}/attempts/${env("GITHUB_RUN_ATTEMPT")}/jobs`,
    "--jq",
    JOBS_FILTER,
  ],
  { env: { GH_TOKEN: env("GH_TOKEN") } },
)
  .split("\n")
  .filter((line) => line !== "")
  .map((line): unknown => JSON.parse(line));
await fetchJson(`https://${AUDIENCE}.${subdomain}.workers.dev`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ jobs }),
});
