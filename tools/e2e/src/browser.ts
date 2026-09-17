import { chmod, lstat, mkdir } from "node:fs/promises";
import {
  decodeBrowserBatch,
  ensure,
  object,
  poll,
  privateDirectoryMode,
  root,
  run,
  string,
} from "./support.ts";
import { Cdp } from "./cdp.ts";
import type { CdpSession } from "./cdp.ts";
import { NetworkObserver } from "./network-observer.ts";
import type { ObservedRequest } from "./observation.ts";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { httpStatus } from "./http.ts";
import path from "node:path";
import { tmpdir } from "node:os";

type BrowserCommand = readonly string[];

interface ExpandedCommand {
  readonly command: BrowserCommand;
  readonly wait: boolean;
}

interface ApiRequest {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: string;
}

interface ApiResponse {
  readonly data: unknown;
  readonly requestId: unknown;
  readonly status: number;
  readonly traceparent: unknown;
}

interface Observation {
  readonly requests: ObservedRequest[];
  readonly secrets: string[];
}

const rateLimitWindow = 11_000;
const rateLimitRetries = 3;
const browserCommandTimeout = 60_000;
const socketDirectoryHashLength = 12;
const socketDirectory = path.join(
  tmpdir(),
  `ab-${createHash("sha256").update(root).digest("hex").slice(0, socketDirectoryHashLength)}`,
);

function enabledButton(name: string): string[] {
  return [
    "wait",
    "--fn",
    `Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && (button.getAttribute("aria-label") ?? button.textContent ?? "").replace(/\\s+/g, "") === ${JSON.stringify(name.replaceAll(/\s+/gu, ""))})`,
  ];
}

function clickedButtonName(command: BrowserCommand): string | undefined {
  const [find, locator, role, action, flag, name] = command;
  return find === "find" &&
    locator === "role" &&
    role === "button" &&
    action === "click" &&
    flag === "--name"
    ? name
    : undefined;
}

function expandCommand(command: BrowserCommand): ExpandedCommand[] {
  const name = clickedButtonName(command);
  if (name === undefined) {
    return [{ command, wait: false }];
  }
  return [
    { command: enabledButton(name), wait: true },
    { command, wait: false },
  ];
}

function fetchScript(pathname: string, request: ApiRequest): string {
  const body =
    request.body === undefined ? "" : `body: ${JSON.stringify(JSON.stringify(request.body))},`;
  return `(async () => {
      const response = await fetch(${JSON.stringify(pathname)}, {
        method: ${JSON.stringify(request.method ?? "GET")},
        headers: ${JSON.stringify({ ...request.headers, "content-type": "application/json" })},
        credentials: "same-origin",
        ${body}
      });
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = null; }
      return { status: response.status, requestId: response.headers.get("x-request-id"), traceparent: response.headers.get("traceparent"), data };
    })()`;
}

async function ensureSocketDirectory(): Promise<string> {
  await mkdir(socketDirectory, { mode: privateDirectoryMode, recursive: true });
  const entry = await lstat(socketDirectory);
  ensure(
    entry.isDirectory() && entry.uid === process.getuid?.(),
    "E2E_BROWSER_SOCKET_DIRECTORY_NOT_OWNED",
  );
  await chmod(socketDirectory, privateDirectoryMode);
  return socketDirectory;
}

class Browser {
  #cdp: Cdp | undefined;
  readonly #connections = new Set<CdpSession>();
  readonly #config: string;
  readonly #network = new NetworkObserver();
  readonly #session: string;

  public constructor(session: string, config: string) {
    this.#session = session;
    this.#config = config;
  }

  public addSecret(secret: string): void {
    this.#network.addSecret(secret);
  }

  public async commands(
    ...commands: readonly BrowserCommand[]
  ): Promise<Record<string, unknown>[]> {
    if (this.#cdp === undefined) {
      await this.#observe();
    }
    const expanded = commands.flatMap((command) => expandCommand(command));
    const results = await this.#execute(...expanded.map((entry) => entry.command));
    return results.filter((_result, index) => expanded[index]?.wait !== true);
  }

  public async finishObservation(): Promise<Observation> {
    return this.#network.finish();
  }

  public async evaluate(script: string): Promise<unknown> {
    const [result] = await this.commands(["eval", script]);
    ensure(result !== undefined, "E2E_BROWSER_MISSING_EVAL");
    return result["result"];
  }

  public async api(pathname: string, request: ApiRequest = {}): Promise<ApiResponse> {
    ensure(pathname.startsWith("/") && !pathname.startsWith("//"), "E2E_SAME_ORIGIN_API_REQUIRED");
    return this.#apiAttempt(pathname, request, 0);
  }

  public async open(origin: string, pathname: string): Promise<void> {
    await this.commands(["open", new URL(pathname, origin).href]);
  }

  public async submitAuthentication(
    pathname: string,
    commands: readonly BrowserCommand[],
  ): Promise<void> {
    await this.#submitAttempt(pathname, commands, 0);
  }

  public async login(origin: string, email: string, password: string): Promise<void> {
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

  public async waitText(text: string): Promise<void> {
    await this.commands(["wait", "--text", text]);
  }

  public async close(): Promise<void> {
    for (const connection of this.#connections) {
      connection.close();
    }
    await this.#execute(["close"]);
  }

  public async connectCdp(): Promise<Cdp> {
    const [metadata, tabList] = await this.#execute(["get", "cdp-url"], ["tab", "list"]);
    ensure(metadata !== undefined && tabList !== undefined, "E2E_CDP_METADATA_MISSING");
    const url = string(metadata["cdpUrl"]);
    const { tabs } = tabList;
    ensure(Array.isArray(tabs), "E2E_CDP_TABS_MISSING");
    const tab: unknown = tabs.find((entry: unknown) => object(entry)["active"] === true);
    const cdp = await Cdp.attach(url, string(object(tab)["targetId"]));
    this.#connections.add(cdp);
    return cdp;
  }

  async #execute(...commands: readonly BrowserCommand[]): Promise<Record<string, unknown>[]> {
    const output = await run(
      "agent-browser",
      [
        "--config",
        this.#config,
        "--allowed-domains",
        "localhost,127.0.0.1",
        "--session",
        this.#session,
        "--json",
        "batch",
        "--bail",
      ],
      {
        environment: { AGENT_BROWSER_SOCKET_DIR: await ensureSocketDirectory() },
        input: JSON.stringify(commands),
        timeout: browserCommandTimeout,
      },
    );
    return decodeBrowserBatch(output);
  }

  async #observe(): Promise<void> {
    const cdp = await this.connectCdp();
    this.#cdp = cdp;
    await this.#network.attach(cdp);
  }

  async #apiAttempt(pathname: string, request: ApiRequest, attempt: number): Promise<ApiResponse> {
    const result = object(await this.evaluate(fetchScript(pathname, request)));
    const { status } = result;
    ensure(typeof status === "number", "E2E_MISSING_RESPONSE_STATUS");
    if (
      status === httpStatus.tooManyRequests &&
      pathname.startsWith("/api/auth/") &&
      attempt < rateLimitRetries
    ) {
      await delay(rateLimitWindow);
      return this.#apiAttempt(pathname, request, attempt + 1);
    }
    return {
      data: result["data"],
      requestId: result["requestId"],
      status,
      traceparent: result["traceparent"],
    };
  }

  async #submitAttempt(
    pathname: string,
    commands: readonly BrowserCommand[],
    attempt: number,
  ): Promise<void> {
    const observed = this.#network.requestCount();
    await this.commands(...commands);
    const response = await poll({
      accept: (request) => request !== undefined,
      code: "E2E_AUTHENTICATION_RESPONSE_MISSING",
      read: () =>
        this.#network.requestsSince(observed).find((request) => request.path === pathname),
    });
    if (response?.status !== httpStatus.tooManyRequests || attempt >= rateLimitRetries) {
      return;
    }
    await delay(rateLimitWindow);
    await this.#submitAttempt(pathname, commands, attempt + 1);
  }
}

type BrowserSession = Readonly<Pick<Browser, keyof Browser>>;

export { Browser, enabledButton };
export type { BrowserCommand, BrowserSession };
