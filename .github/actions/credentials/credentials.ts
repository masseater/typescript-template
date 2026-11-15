import { appendTo, fetchJsonWithRetry, field, mask, oidcToken } from "../shared/runner.ts";

const BROKER = "https://credentials.masseater.dev/";
const FIELDS: Readonly<Record<string, string>> = {
  CLAUDE_CODE_OAUTH_TOKEN: "claudeCodeOauthToken",
  CLOUDFLARE_API_TOKEN: "token",
  CLOUDFLARE_ACCOUNT_ID: "accountId",
  GITHUB_APP_TOKEN: "githubToken",
};

const oidc = await oidcToken("masseater-dev-credential-broker");
const response = await fetchJsonWithRetry(BROKER, {
  method: "POST",
  headers: { authorization: `Bearer ${oidc}` },
});
const values = Object.values(response ?? {});
for (const value of values) {
  if (typeof value === "string") {
    mask(value);
  }
}
const granted = Object.entries(FIELDS).flatMap(([name, key]) => {
  const value = field(response, key);
  if (typeof value === "string") {
    return [[name, value] as const];
  }
  return [];
});
appendTo("GITHUB_ENV", Object.fromEntries(granted));
