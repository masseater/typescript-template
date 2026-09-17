import { ensure, grafana, json, mailpit, run } from "./support.ts";

const agentBrowserVersion = "agent-browser 0.37.1";
const services = [
  { name: "Mailpit:8025", url: `${mailpit}/api/v1/info` },
  { name: "Grafana:3100", url: `${grafana}/api/health` },
  {
    init: {
      body: '{"resourceSpans":[]}',
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    name: "OTLP:4318",
    url: "http://127.0.0.1:4318/v1/traces",
  },
];

async function prerequisites(): Promise<void> {
  const results = await Promise.allSettled(
    services.map(async ({ init, url }) => {
      await json(url, init);
    }),
  );
  const missing = services
    .filter((_service, index) => results[index]?.status === "rejected")
    .map(({ name }) => name);
  ensure(
    missing.length === 0,
    `E2E_DEPENDENCIES_UNAVAILABLE: ${missing.join(", ")}. Start the real local services; E2E cannot be skipped or mocked.`,
  );
  const version = await run("agent-browser", ["--version"]);
  ensure(version.trim() === agentBrowserVersion, "E2E_REQUIRES_AGENT_BROWSER_0.37.1");
  await run("tmux", ["-V"]);
}

export { prerequisites };
