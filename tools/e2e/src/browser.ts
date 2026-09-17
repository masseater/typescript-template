import { createHash } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { decodeBrowserBatch, ensure, object, poll, run, string, root } from "./support.ts";
import { collectSecrets, header } from "./observation.ts";
import type { ObservedRequest } from "./observation.ts";

export const enabledButton = (name: string) => [
  "wait",
  "--fn",
  `Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && (button.getAttribute("aria-label") ?? button.textContent ?? "").replace(/\\s+/g, "") === ${JSON.stringify(name.replace(/\s+/g, ""))})`,
];

const socketDirectory = join(
  tmpdir(),
  `ab-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`,
);

const rateLimitWindow = 11_000;
const rateLimitRetries = 3;

export class Browser {
  readonly observedRequests: ObservedRequest[] = [];
  readonly secrets = new Set<string>();
  private observer: Cdp | undefined;
  private observationFailure = false;
  private readonly bodyReads = new Set<Promise<void>>();
  readonly session: string;
  private readonly config: string;

  constructor(session: string, config: string) {
    this.session = session;
    this.config = config;
  }

  private async execute(...commands: string[][]) {
    await mkdir(socketDirectory, { recursive: true, mode: 0o700 });
    await chmod(socketDirectory, 0o700);
    const output = await run(
      "agent-browser",
      [
        "--config",
        this.config,
        "--allowed-domains",
        "localhost,127.0.0.1",
        "--session",
        this.session,
        "--json",
        "batch",
        "--bail",
      ],
      JSON.stringify(commands),
      60_000,
      { AGENT_BROWSER_SOCKET_DIR: socketDirectory },
    );
    return decodeBrowserBatch(output);
  }

  async commands(...commands: string[][]) {
    if (!this.observer) await this.observe();
    const expanded = commands.flatMap((command): { command: string[]; wait: boolean }[] => {
      const [find, locator, role, action, flag, name] = command;
      if (
        find !== "find" ||
        locator !== "role" ||
        role !== "button" ||
        action !== "click" ||
        flag !== "--name" ||
        name === undefined
      )
        return [{ command, wait: false }];
      return [
        { command: enabledButton(name), wait: true },
        { command, wait: false },
      ];
    });
    const results = await this.execute(...expanded.map((entry) => entry.command));
    return results.filter((_, index) => !expanded[index]?.wait);
  }

  async finishObservation() {
    await Promise.all([...this.bodyReads]);
    ensure(!this.observationFailure, "E2E_NETWORK_OBSERVATION_FAILED");
    return { requests: [...this.observedRequests], secrets: [...this.secrets] };
  }

  private async observe() {
    const cdp = await this.connectCdp();
    this.observer = cdp;
    const pending = new Map<
      string,
      { path: string; method: string; kind: string; clientTraceparent?: string }
    >();
    const capture = (networkId: string, raw: unknown) => {
      const request = pending.get(networkId);
      if (!request) return;
      const response = object(raw);
      const headers = object(response["headers"]);
      const requestId = header(headers, "x-request-id");
      const traceparent = header(headers, "traceparent");
      ensure(requestId && traceparent, "E2E_RESPONSE_CORRELATION_MISSING");
      const status = response["status"];
      ensure(typeof status === "number", "E2E_RESPONSE_STATUS_MISSING");
      this.observedRequests.push({ ...request, requestId, traceparent, status });
      const cookie = header(headers, "set-cookie");
      if (cookie)
        for (const line of cookie.split("\n")) {
          const value = line.split(";", 1)[0]?.split("=").slice(1).join("=");
          if (value) this.secrets.add(value);
        }
    };
    cdp.onEvent((method, data) => {
      if (method === "Fetch.requestPaused") {
        const read = (async () => {
          const pausedId = string(data["requestId"]);
          try {
            const status = data["responseStatusCode"];
            if (typeof status === "number" && (status < 300 || status >= 400)) {
              const result = await cdp.send("Fetch.getResponseBody", { requestId: pausedId });
              const raw = string(result["body"]);
              const body =
                result["base64Encoded"] === true
                  ? Buffer.from(raw, "base64").toString("utf8")
                  : raw;
              if (body) collectSecrets(JSON.parse(body) as unknown, this.secrets);
            }
          } catch {
            this.observationFailure = true;
          } finally {
            await cdp.send("Fetch.continueResponse", { requestId: pausedId }).catch(() => {
              this.observationFailure = true;
              return {};
            });
          }
        })();
        this.bodyReads.add(read);
        void read.finally(() => this.bodyReads.delete(read));
        return;
      }
      try {
        const networkId = data["requestId"];
        if (typeof networkId !== "string") return;
        if (method === "Network.requestWillBeSent") {
          if (data["redirectResponse"]) capture(networkId, data["redirectResponse"]);
          pending.delete(networkId);
          const request = object(data["request"]);
          const url = new URL(string(request["url"]));
          if (
            !["localhost", "127.0.0.1"].includes(url.hostname) ||
            !url.pathname.startsWith("/api/") ||
            ["/api/telemetry", "/api/client-config"].includes(url.pathname)
          )
            return;
          for (const key of ["token", "code"]) {
            const secret = url.searchParams.get(key);
            if (secret) this.secrets.add(secret);
          }
          const headers = object(request["headers"]);
          const clientTraceparent = header(headers, "traceparent");
          pending.set(networkId, {
            path: url.pathname,
            method: string(request["method"]),
            kind: string(data["type"]),
            ...(clientTraceparent ? { clientTraceparent } : {}),
          });
          if (typeof request["postData"] === "string") {
            collectSecrets(JSON.parse(request["postData"]) as unknown, this.secrets);
          }
        } else if (method === "Network.responseReceived") {
          capture(networkId, data["response"]);
        } else if (method === "Network.loadingFinished") {
          pending.delete(networkId);
        } else if (method === "Network.loadingFailed") {
          if (pending.has(networkId)) this.observationFailure = true;
          pending.delete(networkId);
        }
      } catch {
        this.observationFailure = true;
      }
    });
    await cdp.send("Network.enable", {
      maxTotalBufferSize: 8_000_000,
      maxResourceBufferSize: 1_000_000,
      maxPostDataSize: 64_000,
    });
    await cdp.send("Fetch.enable", {
      patterns: [{ urlPattern: "*/api/auth/*", requestStage: "Response" }],
    });
  }

  async evaluate(script: string): Promise<unknown> {
    const results = await this.commands(["eval", script]);
    ensure(results[0], "E2E_BROWSER_MISSING_EVAL");
    return results[0]["result"];
  }

  async api(
    path: string,
    method = "GET",
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    ensure(path.startsWith("/") && !path.startsWith("//"), "E2E_SAME_ORIGIN_API_REQUIRED");
    for (let attempt = 0; ; attempt += 1) {
      const result = object(
        await this.evaluate(`(async () => {
      const response = await fetch(${JSON.stringify(path)}, {
        method: ${JSON.stringify(method)},
        headers: ${JSON.stringify({ ...extraHeaders, "content-type": "application/json" })},
        credentials: "same-origin",
        ${body === undefined ? "" : `body: ${JSON.stringify(JSON.stringify(body))},`}
      });
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = null; }
      return { status: response.status, requestId: response.headers.get("x-request-id"), traceparent: response.headers.get("traceparent"), data };
    })()`),
      );
      ensure(typeof result["status"] === "number", "E2E_MISSING_RESPONSE_STATUS");
      if (result["status"] === 429 && path.startsWith("/api/auth/") && attempt < rateLimitRetries) {
        await delay(rateLimitWindow);
        continue;
      }
      return {
        status: result["status"],
        data: result["data"],
        requestId: result["requestId"],
        traceparent: result["traceparent"],
      };
    }
  }

  async open(origin: string, path: string) {
    await this.commands(["open", new URL(path, origin).href]);
  }

  async submitAuthentication(path: string, commands: string[][]) {
    for (let attempt = 0; ; attempt += 1) {
      const observed = this.observedRequests.length;
      await this.commands(...commands);
      const response = await poll(
        async () => this.observedRequests.slice(observed).find((request) => request.path === path),
        (request) => request !== undefined,
        "E2E_AUTHENTICATION_RESPONSE_MISSING",
      );
      if (response?.status !== 429 || attempt >= rateLimitRetries) return;
      await delay(rateLimitWindow);
    }
  }

  async login(origin: string, email: string, password: string) {
    await this.open(origin, "/login");
    await this.commands(
      ["wait", 'input[name="email"]'],
      enabledButton("ログイン"),
      ["fill", 'input[name="email"]', email],
      ["fill", 'input[name="password"]', password],
    );
    await this.submitAuthentication("/api/auth/sign-in/email", [
      ["find", "role", "button", "click", "--name", "ログイン", "--exact"],
    ]);
  }

  async waitText(text: string) {
    await this.commands(["wait", "--text", text]);
  }
  async close() {
    this.observer?.close();
    await this.execute(["close"]);
  }

  async connectCdp() {
    const result = await this.execute(["get", "cdp-url"], ["tab", "list"]);
    ensure(result[0] && result[1], "E2E_CDP_METADATA_MISSING");
    const url = string(result[0]["cdpUrl"]);
    const tabs = result[1]["tabs"];
    ensure(Array.isArray(tabs), "E2E_CDP_TABS_MISSING");
    const tab: unknown = tabs.find((entry: unknown) => object(entry)["active"] === true);
    const targetId = string(object(tab)["targetId"]);
    const cdp = await Cdp.connect(url);
    const attached = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    cdp.sessionId = string(attached["sessionId"]);
    return cdp;
  }
}

export class Cdp {
  private readonly listeners: ((method: string, params: Record<string, unknown>) => void)[] = [];
  private nextId = 0;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  sessionId: string | undefined;
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      const data = object(JSON.parse(event.data) as unknown);
      const id = data["id"];
      if (typeof id !== "number") {
        if (typeof data["method"] === "string" && data["sessionId"] === this.sessionId)
          for (const listener of this.listeners) listener(data["method"], object(data["params"]));
        return;
      }
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      if (data["error"]) pending.reject(new Error("E2E_CDP_COMMAND_FAILED"));
      else pending.resolve(object(data["result"]));
    });
  }

  onEvent(listener: (method: string, params: Record<string, unknown>) => void) {
    this.listeners.push(listener);
  }

  static async connect(url: string) {
    const parsed = new URL(url);
    ensure(parsed.protocol === "ws:" && parsed.hostname === "127.0.0.1", "E2E_CDP_MUST_BE_LOCAL");
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error("E2E_CDP_CONNECT_TIMEOUT"));
      }, 10_000);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("E2E_CDP_CONNECT_FAILED"));
        },
        { once: true },
      );
    });
    return new Cdp(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("E2E_CDP_COMMAND_TIMEOUT"));
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(this.sessionId ? { sessionId: this.sessionId } : {}),
        }),
      );
    });
  }

  async authenticator() {
    await this.send("WebAuthn.enable", { enableUI: false });
    const result = await this.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    return string(result["authenticatorId"]);
  }

  close() {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("E2E_CDP_CLOSED"));
    }
    this.pending.clear();
    this.socket.close();
  }
}
