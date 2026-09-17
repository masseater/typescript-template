import { ensure, object, string } from "./support.ts";
import { findSecrets, header } from "./observation.ts";
import type { CdpSession } from "./cdp.ts";
import type { ObservedRequest } from "./observation.ts";
import { httpStatus } from "./http.ts";

interface PendingRequest {
  readonly clientTraceparent?: string;
  readonly kind: string;
  readonly method: string;
  readonly path: string;
}

interface Observation {
  readonly requests: ObservedRequest[];
  readonly secrets: string[];
}

type CdpEvent = Readonly<Record<string, unknown>>;

const localHosts = new Set(["localhost", "127.0.0.1"]);
const unobservedApiPaths = new Set(["/api/telemetry", "/api/client-config"]);
const secretSearchParameters = ["token", "code"];
const networkBuffers = {
  maxPostDataSize: 64_000,
  maxResourceBufferSize: 1_000_000,
  maxTotalBufferSize: 8_000_000,
};

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function cookieValues(cookie: string | undefined): string[] {
  return (cookie ?? "")
    .split("\n")
    .map((line) => line.split(";", 1)[0]?.split("=").slice(1).join("="))
    .filter((value) => nonEmpty(value));
}

function isObservedApi(url: Readonly<URL>): boolean {
  return (
    localHosts.has(url.hostname) &&
    url.pathname.startsWith("/api/") &&
    !unobservedApiPaths.has(url.pathname)
  );
}

interface ObservedResponse {
  readonly cookies: string[];
  readonly requestId: string;
  readonly status: number;
  readonly traceparent: string;
}

function observedResponse(raw: unknown): ObservedResponse {
  const response = object(raw);
  const headers = object(response["headers"]);
  const requestId = header(headers, "x-request-id");
  const traceparent = header(headers, "traceparent");
  ensure(nonEmpty(requestId) && nonEmpty(traceparent), "E2E_RESPONSE_CORRELATION_MISSING");
  const { status } = response;
  ensure(typeof status === "number", "E2E_RESPONSE_STATUS_MISSING");
  return { cookies: cookieValues(header(headers, "set-cookie")), requestId, status, traceparent };
}

function hasBody(status: unknown): boolean {
  return (
    typeof status === "number" &&
    (status < httpStatus.redirection || status >= httpStatus.badRequest)
  );
}

class NetworkObserver {
  readonly #bodyReads = new Set<Promise<void>>();
  #failed = false;
  readonly #pending = new Map<string, PendingRequest>();
  readonly #requests: ObservedRequest[] = [];
  readonly #secrets = new Set<string>();

  public addSecret(secret: string): void {
    this.#secrets.add(secret);
  }

  public requestCount(): number {
    return this.#requests.length;
  }

  public requestsSince(index: number): ObservedRequest[] {
    return this.#requests.slice(index);
  }

  public async finish(): Promise<Observation> {
    await Promise.all(this.#bodyReads);
    ensure(!this.#failed, "E2E_NETWORK_OBSERVATION_FAILED");
    return { requests: [...this.#requests], secrets: [...this.#secrets] };
  }

  public async attach(cdp: CdpSession): Promise<void> {
    cdp.onEvent((method, data) => {
      this.#handle(cdp, method, data);
    });
    await cdp.send("Network.enable", networkBuffers);
    await cdp.send("Fetch.enable", {
      patterns: [{ requestStage: "Response", urlPattern: "*/api/auth/*" }],
    });
  }

  #handle(cdp: CdpSession, method: string, data: CdpEvent): void {
    if (method === "Fetch.requestPaused") {
      const read = this.#readPausedBody(cdp, data);
      this.#bodyReads.add(read);
      void this.#forgetBodyRead(read);
      return;
    }
    try {
      this.#handleNetwork(method, data);
    } catch {
      this.#failed = true;
    }
  }

  async #forgetBodyRead(read: Promise<void>): Promise<void> {
    try {
      await read;
    } finally {
      this.#bodyReads.delete(read);
    }
  }

  async #readPausedBody(cdp: CdpSession, data: CdpEvent): Promise<void> {
    const pausedId = string(data["requestId"]);
    try {
      if (hasBody(data["responseStatusCode"])) {
        const result = await cdp.send("Fetch.getResponseBody", { requestId: pausedId });
        const raw = string(result["body"]);
        const body =
          result["base64Encoded"] === true ? Buffer.from(raw, "base64").toString("utf-8") : raw;
        if (body.length > 0) {
          this.#collectJsonSecrets(body);
        }
      }
    } catch {
      this.#failed = true;
    } finally {
      await this.#continueResponse(cdp, pausedId);
    }
  }

  async #continueResponse(cdp: CdpSession, pausedId: string): Promise<void> {
    try {
      await cdp.send("Fetch.continueResponse", { requestId: pausedId });
    } catch {
      this.#failed = true;
    }
  }

  #collectJsonSecrets(body: string): void {
    for (const secret of findSecrets(JSON.parse(body) as unknown)) {
      this.#secrets.add(secret);
    }
  }

  #handleNetwork(method: string, data: CdpEvent): void {
    const networkId = data["requestId"];
    if (typeof networkId !== "string") {
      return;
    }
    if (method === "Network.requestWillBeSent") {
      this.#requestWillBeSent(networkId, data);
    } else if (method === "Network.responseReceived") {
      this.#capture(networkId, data["response"]);
    } else if (method === "Network.loadingFinished") {
      this.#pending.delete(networkId);
    } else if (method === "Network.loadingFailed") {
      this.#failed ||= this.#pending.has(networkId);
      this.#pending.delete(networkId);
    }
  }

  #requestWillBeSent(networkId: string, data: CdpEvent): void {
    if (data["redirectResponse"] !== undefined) {
      this.#capture(networkId, data["redirectResponse"]);
    }
    this.#pending.delete(networkId);
    const request = object(data["request"]);
    const url = new URL(string(request["url"]));
    if (isObservedApi(url)) {
      this.#observeRequest({ data, networkId, request, url });
    }
  }

  #observeRequest(
    event: Readonly<{ data: CdpEvent; networkId: string; request: CdpEvent; url: Readonly<URL> }>,
  ): void {
    const { data, networkId, request, url } = event;
    for (const secret of secretSearchParameters.map((key) => url.searchParams.get(key))) {
      if (nonEmpty(secret)) {
        this.#secrets.add(secret);
      }
    }
    const clientTraceparent = header(object(request["headers"]), "traceparent");
    this.#pending.set(networkId, {
      kind: string(data["type"]),
      method: string(request["method"]),
      path: url.pathname,
      ...(nonEmpty(clientTraceparent) ? { clientTraceparent } : {}),
    });
    const { postData } = request;
    if (typeof postData === "string") {
      this.#collectJsonSecrets(postData);
    }
  }

  #capture(networkId: string, raw: unknown): void {
    const request = this.#pending.get(networkId);
    if (request === undefined) {
      return;
    }
    const { cookies, requestId, status, traceparent } = observedResponse(raw);
    this.#requests.push({ ...request, requestId, status, traceparent });
    for (const value of cookies) {
      this.#secrets.add(value);
    }
  }
}

export { NetworkObserver };
