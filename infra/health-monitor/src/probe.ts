import type { Application as HealthService } from "@template/config";
import * as v from "valibot";

export interface HealthTarget {
  readonly service: HealthService;
  readonly origin: string;
}

export interface ProbeResult {
  readonly service: HealthService;
  readonly healthy: boolean;
  readonly detail: string;
}

const payload = v.object({
  ok: v.literal(true),
  service: v.string(),
  release: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._-]{1,64}$/)),
});

export async function probeService(target: HealthTarget): Promise<ProbeResult> {
  const result = (healthy: boolean, detail: string) => ({
    service: target.service,
    healthy,
    detail,
  });
  let response: Response;
  try {
    response = await fetch(`${target.origin}/api/health`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
  } catch {
    return result(false, "unreachable");
  }
  if (!response.ok) return result(false, `status_${response.status}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return result(false, "body_unreadable");
  }
  const parsed = v.safeParse(payload, body);
  if (!parsed.success || parsed.output.service !== target.service)
    return result(false, "payload_invalid");
  return result(true, `release_${parsed.output.release}`);
}
