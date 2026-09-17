import { createHash } from "node:crypto";
import { chmod, lstat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Fiber, Option, Schema } from "effect";
import type { E2eFailure } from "./support.ts";
import {
  decodeBrowserBatch,
  ensure,
  fail,
  object,
  parseJson,
  poll,
  root,
  run,
  string,
} from "./support.ts";
import { collectSecrets, header } from "./observation.ts";
import type { ObservedRequest } from "./observation.ts";

export const enabledButton = (name: string) => [
  "wait",
  "--fn",
  `Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && (button.getAttribute("aria-label") ?? button.textContent ?? "").replace(/\\s+/g, "") === ${JSON.stringify(name.replace(/\s+/g, ""))})`,
];

const rateLimitWindow = 11_000;
const rateLimitRetries = 3;

const CdpMessage = Schema.fromJsonString(
  Schema.Struct({
    id: Schema.optionalKey(Schema.Finite),
    method: Schema.optionalKey(Schema.String),
    sessionId: Schema.optionalKey(Schema.String),
    params: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
    result: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
    error: Schema.optionalKey(Schema.Unknown),
  }),
);
const decodeCdpMessage = Schema.decodeUnknownOption(CdpMessage);

type CdpReply = Effect.Effect<Record<string, unknown>, E2eFailure>;

function makeCdp(socket: WebSocket) {
  const listeners: ((method: string, params: Record<string, unknown>) => void)[] = [];
  const pending = new Map<
    number,
    { resume: (reply: CdpReply) => void; timer: ReturnType<typeof setTimeout> }
  >();
  let nextId = 0;
  let sessionId: string | undefined;
  const send = (
    method: string,
    params: Record<string, unknown> = {},
  ): Effect.Effect<Record<string, unknown>, E2eFailure> =>
    Effect.callback<Record<string, unknown>, E2eFailure>((resume) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        resume(fail("E2E_CDP_COMMAND_TIMEOUT"));
      }, 10_000);
      pending.set(id, { resume, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return Effect.sync(() => {
        clearTimeout(timer);
        pending.delete(id);
      });
    });
  const cdp = {
    send,
    attach(target: string) {
      sessionId = target;
    },
    onEvent(listener: (method: string, params: Record<string, unknown>) => void) {
      listeners.push(listener);
    },
    authenticator: Effect.fn("Cdp.authenticator")(function* () {
      yield* send("WebAuthn.enable", { enableUI: false });
      const result = yield* send("WebAuthn.addVirtualAuthenticator", {
        options: {
          protocol: "ctap2",
          transport: "internal",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      return yield* string(result["authenticatorId"]);
    }),
    close() {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.resume(fail("E2E_CDP_CLOSED"));
      }
      pending.clear();
      socket.close();
    },
  };
  socket.addEventListener("message", (event: MessageEvent) => {
    const message = decodeCdpMessage(event.data);
    if (Option.isNone(message)) return;
    const data = message.value;
    if (data.id === undefined) {
      if (data.method !== undefined && data.params && data.sessionId === sessionId)
        for (const listener of listeners) listener(data.method, data.params);
      return;
    }
    const request = pending.get(data.id);
    if (!request) return;
    if (data.error) {
      pending.delete(data.id);
      clearTimeout(request.timer);
      request.resume(fail("E2E_CDP_COMMAND_FAILED"));
    } else if (data.result) {
      pending.delete(data.id);
      clearTimeout(request.timer);
      request.resume(Effect.succeed(data.result));
    }
  });
  return cdp;
}

type Cdp = ReturnType<typeof makeCdp>;

const connect = Effect.fn("Cdp.connect")(function* (url: string) {
  const parsed = URL.parse(url);
  yield* ensure(
    parsed?.protocol === "ws:" && parsed.hostname === "127.0.0.1",
    "E2E_CDP_MUST_BE_LOCAL",
  );
  const socket = yield* Effect.callback<WebSocket, E2eFailure>((resume) => {
    const opening = new WebSocket(url);
    const timer = setTimeout(() => {
      opening.close();
      resume(fail("E2E_CDP_CONNECT_TIMEOUT"));
    }, 10_000);
    opening.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resume(Effect.succeed(opening));
      },
      { once: true },
    );
    opening.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        resume(fail("E2E_CDP_CONNECT_FAILED"));
      },
      { once: true },
    );
    return Effect.sync(() => {
      clearTimeout(timer);
      opening.close();
    });
  });
  return makeCdp(socket);
});

export function makeBrowser(session: string, config: string) {
  const observedRequests: ObservedRequest[] = [];
  const secrets = new Set<string>();
  const bodyReads = new Set<Fiber.Fiber<void, E2eFailure>>();
  let observer: Cdp | undefined;
  let observationFailure = false;
  const markObservationFailure = Effect.sync(() => {
    observationFailure = true;
  });

  const execute = Effect.fn("Browser.execute")(function* (...commands: string[][]) {
    const socketDirectory = join(
      tmpdir(),
      `ab-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`,
    );
    yield* Effect.tryPromise(() => mkdir(socketDirectory, { recursive: true, mode: 0o700 }));
    const entry = yield* Effect.tryPromise(() => lstat(socketDirectory));
    yield* ensure(
      entry.isDirectory() && entry.uid === process.getuid?.(),
      "E2E_BROWSER_SOCKET_DIRECTORY_NOT_OWNED",
    );
    yield* Effect.tryPromise(() => chmod(socketDirectory, 0o700));
    const output = yield* run(
      "agent-browser",
      [
        "--config",
        config,
        "--allowed-domains",
        "localhost,127.0.0.1",
        "--session",
        session,
        "--json",
        "batch",
        "--bail",
      ],
      JSON.stringify(commands),
      60_000,
      { AGENT_BROWSER_SOCKET_DIR: socketDirectory },
    );
    return yield* decodeBrowserBatch(output);
  });

  const connectCdp = Effect.fn("Browser.connectCdp")(function* () {
    const [metadata, tabList] = yield* execute(["get", "cdp-url"], ["tab", "list"]);
    if (!metadata || !tabList) return yield* fail("E2E_CDP_METADATA_MISSING");
    const url = yield* string(metadata["cdpUrl"]);
    const tabs = tabList["tabs"];
    if (!Array.isArray(tabs)) return yield* fail("E2E_CDP_TABS_MISSING");
    let tab: unknown;
    for (const entry of tabs as unknown[])
      if ((yield* object(entry))["active"] === true) {
        tab = entry;
        break;
      }
    const targetId = yield* string((yield* object(tab))["targetId"]);
    const cdp = yield* connect(url);
    const attached = yield* cdp.send("Target.attachToTarget", { targetId, flatten: true });
    cdp.attach(yield* string(attached["sessionId"]));
    return cdp;
  });

  const observe = Effect.fn("Browser.observe")(function* () {
    const cdp = yield* connectCdp();
    observer = cdp;
    const pending = new Map<
      string,
      { path: string; method: string; kind: string; clientTraceparent?: string }
    >();
    const capture = Effect.fn("Browser.capture")(function* (networkId: string, raw: unknown) {
      const request = pending.get(networkId);
      if (!request) return;
      const response = yield* object(raw);
      const headers = yield* object(response["headers"]);
      const requestId = header(headers, "x-request-id");
      const traceparent = header(headers, "traceparent");
      if (!requestId || !traceparent) return yield* fail("E2E_RESPONSE_CORRELATION_MISSING");
      const status = response["status"];
      if (typeof status !== "number") return yield* fail("E2E_RESPONSE_STATUS_MISSING");
      observedRequests.push({ ...request, requestId, traceparent, status });
      const cookie = header(headers, "set-cookie");
      if (cookie)
        for (const line of cookie.split("\n")) {
          const value = line.split(";", 1)[0]?.split("=").slice(1).join("=");
          if (value) secrets.add(value);
        }
    });
    const readBody = Effect.fn("Browser.readBody")(function* (data: Record<string, unknown>) {
      const pausedId = yield* string(data["requestId"]);
      yield* Effect.gen(function* () {
        const status = data["responseStatusCode"];
        if (typeof status === "number" && (status < 300 || status >= 400)) {
          const result = yield* cdp.send("Fetch.getResponseBody", { requestId: pausedId });
          const raw = yield* string(result["body"]);
          const body =
            result["base64Encoded"] === true ? Buffer.from(raw, "base64").toString("utf8") : raw;
          if (body)
            collectSecrets(yield* parseJson(body, "E2E_NETWORK_OBSERVATION_FAILED"), secrets);
        }
      }).pipe(
        Effect.catchCause(() => markObservationFailure),
        Effect.ensuring(
          cdp.send("Fetch.continueResponse", { requestId: pausedId }).pipe(
            Effect.asVoid,
            Effect.catchCause(() => markObservationFailure),
          ),
        ),
      );
    });
    const handle = Effect.fn("Browser.handleNetworkEvent")(function* (
      method: string,
      data: Record<string, unknown>,
    ) {
      const networkId = data["requestId"];
      if (typeof networkId !== "string") return;
      if (method === "Network.requestWillBeSent") {
        if (data["redirectResponse"]) yield* capture(networkId, data["redirectResponse"]);
        pending.delete(networkId);
        const request = yield* object(data["request"]);
        const url = URL.parse(yield* string(request["url"]));
        if (!url) return yield* fail("E2E_NETWORK_OBSERVATION_FAILED");
        if (
          !["localhost", "127.0.0.1"].includes(url.hostname) ||
          !url.pathname.startsWith("/api/") ||
          url.pathname === "/api/telemetry"
        )
          return;
        for (const key of ["token", "code"]) {
          const secret = url.searchParams.get(key);
          if (secret) secrets.add(secret);
        }
        const headers = yield* object(request["headers"]);
        const clientTraceparent = header(headers, "traceparent");
        pending.set(networkId, {
          path: url.pathname,
          method: yield* string(request["method"]),
          kind: yield* string(data["type"]),
          ...(clientTraceparent ? { clientTraceparent } : {}),
        });
        if (typeof request["postData"] === "string")
          collectSecrets(
            yield* parseJson(request["postData"], "E2E_NETWORK_OBSERVATION_FAILED"),
            secrets,
          );
      } else if (method === "Network.responseReceived") {
        yield* capture(networkId, data["response"]);
      } else if (method === "Network.loadingFinished") {
        pending.delete(networkId);
      } else if (method === "Network.loadingFailed") {
        if (pending.has(networkId)) observationFailure = true;
        pending.delete(networkId);
      }
    });
    const context = yield* Effect.context();
    cdp.onEvent((method, data) => {
      if (method === "Fetch.requestPaused") {
        bodyReads.add(Effect.runForkWith(context)(readBody(data)));
        return;
      }
      Effect.runSyncWith(context)(
        handle(method, data).pipe(Effect.catchCause(() => markObservationFailure)),
      );
    });
    yield* cdp.send("Network.enable", {
      maxTotalBufferSize: 8_000_000,
      maxResourceBufferSize: 1_000_000,
      maxPostDataSize: 64_000,
    });
    yield* cdp.send("Fetch.enable", {
      patterns: [{ urlPattern: "*/api/auth/*", requestStage: "Response" }],
    });
  });

  const commands = Effect.fn("Browser.commands")(function* (...input: string[][]) {
    if (!observer) yield* observe();
    const expanded = input.flatMap((command): { command: string[]; wait: boolean }[] => {
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
    const results = yield* execute(...expanded.map((entry) => entry.command));
    return results.filter((_, index) => !expanded[index]?.wait);
  });

  const evaluate = Effect.fn("Browser.evaluate")(function* (script: string) {
    const [result] = yield* commands(["eval", script]);
    if (!result) return yield* fail("E2E_BROWSER_MISSING_EVAL");
    return result["result"];
  });

  const open = Effect.fn("Browser.open")(function* (origin: string, path: string) {
    yield* commands(["open", new URL(path, origin).href]);
  });

  const submitAuthentication = Effect.fn("Browser.submitAuthentication")(function* (
    path: string,
    input: string[][],
  ) {
    for (let attempt = 0; ; attempt += 1) {
      const observed = observedRequests.length;
      yield* commands(...input);
      const response = yield* poll(
        Effect.sync(() =>
          observedRequests.slice(observed).find((request) => request.path === path),
        ),
        (request) => request !== undefined,
        "E2E_AUTHENTICATION_RESPONSE_MISSING",
      );
      if (response?.status !== 429 || attempt >= rateLimitRetries) return;
      yield* Effect.sleep(rateLimitWindow);
    }
  });

  const fillStable = Effect.fn("Browser.fillStable")(function* (
    fields: readonly (readonly [string, string])[],
  ) {
    const filled = `[${fields.map(([selector]) => `(document.querySelector(${JSON.stringify(selector)})?.value.length ?? 0) > 0`).join(",")}].every(Boolean)`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      yield* commands(...fields.map(([selector, value]) => ["fill", selector, value]));
      yield* Effect.sleep(500);
      if ((yield* evaluate(filled)) === true) return;
    }
    return yield* fail("E2E_FORM_INPUT_RESET");
  });

  return {
    session,
    secrets,
    observedRequests,
    commands,
    evaluate,
    open,
    submitAuthentication,
    fillStable,
    connectCdp,
    finishObservation: Effect.fn("Browser.finishObservation")(function* () {
      yield* Fiber.joinAll(bodyReads);
      yield* ensure(!observationFailure, "E2E_NETWORK_OBSERVATION_FAILED");
      return { requests: [...observedRequests], secrets: [...secrets] };
    }),
    api: Effect.fn("Browser.api")(function* (
      path: string,
      method = "GET",
      body?: unknown,
      extraHeaders: Record<string, string> = {},
    ) {
      yield* ensure(path.startsWith("/") && !path.startsWith("//"), "E2E_SAME_ORIGIN_API_REQUIRED");
      for (let attempt = 0; ; attempt += 1) {
        const result = yield* object(
          yield* evaluate(`(async () => {
      const response = await fetch(${JSON.stringify(path)}, {
        method: ${JSON.stringify(method)},
        headers: ${JSON.stringify({ ...extraHeaders, "content-type": "application/json" })},
        credentials: "same-origin",
        ${body === undefined ? "" : `body: ${JSON.stringify(JSON.stringify(body))},`}
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, requestId: response.headers.get("x-request-id"), traceparent: response.headers.get("traceparent"), data };
    })()`),
        );
        const status = result["status"];
        if (typeof status !== "number") return yield* fail("E2E_MISSING_RESPONSE_STATUS");
        if (status === 429 && path.startsWith("/api/auth/") && attempt < rateLimitRetries) {
          yield* Effect.sleep(rateLimitWindow);
          continue;
        }
        return {
          status,
          data: result["data"],
          requestId: result["requestId"],
          traceparent: result["traceparent"],
        };
      }
    }),
    login: Effect.fn("Browser.login")(function* (origin: string, email: string, password: string) {
      yield* open(origin, "/login");
      yield* commands(["wait", 'input[name="email"]'], enabledButton("ログイン"));
      yield* fillStable([
        ['input[name="email"]', email],
        ['input[name="password"]', password],
      ]);
      yield* submitAuthentication("/api/auth/sign-in/email", [
        ["find", "role", "button", "click", "--name", "ログイン", "--exact"],
      ]);
    }),
    waitText: Effect.fn("Browser.waitText")(function* (text: string) {
      yield* commands(["wait", "--text", text]);
    }),
    close: Effect.fn("Browser.close")(function* () {
      observer?.close();
      yield* execute(["close"]);
    }),
  };
}

export type Browser = ReturnType<typeof makeBrowser>;
