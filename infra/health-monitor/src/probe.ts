import type { HealthService, HealthTarget } from "./config.ts";
import { literal, object, pipe, regex, safeParse, string } from "valibot";

interface ProbeResult {
  readonly service: HealthService;
  readonly healthy: boolean;
  readonly detail: string;
}

type ProbeResponse = Readonly<Pick<Response, "json" | "ok" | "status">>;

const REQUEST_TIMEOUT_MS = 10_000;

const payload = object({
  ok: literal(true),
  release: pipe(string(), regex(/^[a-zA-Z0-9._-]{1,64}$/u)),
  service: string(),
});

function probeResult(target: HealthTarget, healthy: boolean, detail: string): ProbeResult {
  return { detail, healthy, service: target.service };
}

async function requestHealth(target: HealthTarget): Promise<ProbeResponse | undefined> {
  try {
    return await fetch(`${target.origin}/api/health`, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return undefined;
  }
}

async function readBody(response: ProbeResponse): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
}

async function payloadResult(target: HealthTarget, response: ProbeResponse): Promise<ProbeResult> {
  const body = await readBody(response);
  if (body === undefined) {
    return probeResult(target, false, "body_unreadable");
  }
  const parsed = safeParse(payload, body);
  if (!parsed.success || parsed.output.service !== target.service) {
    return probeResult(target, false, "payload_invalid");
  }
  return probeResult(target, true, `release_${parsed.output.release}`);
}

async function probeService(target: HealthTarget): Promise<ProbeResult> {
  const response = await requestHealth(target);
  if (response === undefined) {
    return probeResult(target, false, "unreachable");
  }
  if (!response.ok) {
    return probeResult(target, false, `status_${response.status}`);
  }
  return payloadResult(target, response);
}

export { probeService };
export type { ProbeResult };
