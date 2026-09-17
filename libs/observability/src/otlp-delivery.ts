import type { ServiceName, Signal } from "./protocol.ts";
import { httpStatus } from "./http-status.ts";
import { millisecondsPerSecond } from "./protocol.ts";

interface ExporterOptions {
  readonly baseUrl: string;
  readonly headers: Readonly<Record<string, string>> | undefined;
  readonly serviceName: ServiceName;
}
interface Delivery {
  readonly body: string;
  readonly deadline: number;
  readonly signal: Signal;
}

const maximumAttempts = 3;
const attemptTimeoutMilliseconds = 3000;
const retryBaseDelayMilliseconds = 250;
const retryBackoffFactor = 2;
const retryableStatuses: ReadonlySet<number> = new Set([
  httpStatus.tooManyRequests,
  httpStatus.badGateway,
  httpStatus.serviceUnavailable,
  httpStatus.gatewayTimeout,
]);

class ExportError extends Error {
  public readonly retryable: boolean;
  public readonly delay: number;

  public constructor(retryable: boolean, delay = 0) {
    super("OTLP export failed");
    this.name = "ExportError";
    this.retryable = retryable;
    this.delay = delay;
  }
}

function retryAfterDelay(retryAfter: string | null): number {
  if (retryAfter === null) {
    return 0;
  }
  const delay = /^\d+$/u.test(retryAfter)
    ? Number(retryAfter) * millisecondsPerSecond
    : Math.max(0, Date.parse(retryAfter) - Date.now());
  return Number.isFinite(delay) ? delay : 0;
}

function parseExportResponse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ExportError(false);
  }
}

function rejectedPartially(text: string): boolean {
  if (text === "") {
    return false;
  }
  const result = parseExportResponse(text);
  if (typeof result !== "object" || result === null || !("partialSuccess" in result)) {
    return false;
  }
  const partial: unknown = result.partialSuccess;
  return (
    typeof partial === "object" &&
    partial !== null &&
    Object.values(partial).some((value) => value !== "0" && value !== 0 && value !== "")
  );
}

async function sendBatch(options: ExporterOptions, delivery: Delivery): Promise<void> {
  const timeout = Math.max(1, Math.min(attemptTimeoutMilliseconds, delivery.deadline - Date.now()));
  const response = await fetch(`${options.baseUrl}/v1/${delivery.signal}`, {
    body: delivery.body,
    headers: { ...options.headers, "content-type": "application/json" },
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    const delay = retryAfterDelay(response.headers.get("retry-after"));
    await response.body?.cancel();
    throw new ExportError(retryableStatuses.has(response.status), delay);
  }
  if (rejectedPartially(await response.text())) {
    throw new ExportError(false);
  }
}

function retryDelay(error: unknown, attempt: number): number | undefined {
  if (error instanceof ExportError && !error.retryable) {
    return undefined;
  }
  const backoff = retryBaseDelayMilliseconds * retryBackoffFactor ** attempt;
  return Math.max(backoff, error instanceof ExportError ? error.delay : 0);
}

function canRetry(delivery: Delivery, attempt: number, delay: number): boolean {
  return attempt < maximumAttempts - 1 && Date.now() + delay < delivery.deadline;
}

async function wait(milliseconds: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function tryDelivery(
  options: ExporterOptions,
  delivery: Delivery,
  attempt: number,
): Promise<number | "delivered" | "abandoned"> {
  try {
    await sendBatch(options, delivery);
    return "delivered";
  } catch (error) {
    const delay = retryDelay(error, attempt);
    return delay !== undefined && canRetry(delivery, attempt, delay) ? delay : "abandoned";
  }
}

async function deliverWithRetry(
  options: ExporterOptions,
  delivery: Delivery,
  attempt = 0,
): Promise<boolean> {
  if (attempt >= maximumAttempts || Date.now() >= delivery.deadline) {
    return false;
  }
  const outcome = await tryDelivery(options, delivery, attempt);
  if (typeof outcome !== "number") {
    return outcome === "delivered";
  }
  await wait(outcome);
  return deliverWithRetry(options, delivery, attempt + 1);
}

export { deliverWithRetry };
export type { ExporterOptions };
