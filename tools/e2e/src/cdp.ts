import { ensure, object, string } from "./support.ts";

type CdpResult = Readonly<Record<string, unknown>>;
type CdpListener = (method: string, params: CdpResult) => void;

interface PendingCommand {
  readonly reject: (error: Readonly<Error>) => void;
  readonly resolve: (value: CdpResult) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

const cdpTimeout = 10_000;

async function opened(socket: Readonly<WebSocket>): Promise<void> {
  const { promise, reject, resolve } = Promise.withResolvers<Event>();
  const timer = setTimeout(() => {
    socket.close();
    reject(new Error("E2E_CDP_CONNECT_TIMEOUT"));
  }, cdpTimeout);
  socket.addEventListener(
    "open",
    (event) => {
      clearTimeout(timer);
      resolve(event);
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
  await promise;
}

class Cdp {
  readonly #listeners: CdpListener[] = [];
  #nextId = 0;
  readonly #pending = new Map<number, PendingCommand>();
  #sessionId: string | undefined;
  readonly #socket: Readonly<WebSocket>;

  private constructor(socket: Readonly<WebSocket>) {
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      this.#receive(event.data);
    });
  }

  public static async attach(url: string, targetId: string): Promise<Cdp> {
    const parsed = new URL(url);
    ensure(parsed.protocol === "ws:" && parsed.hostname === "127.0.0.1", "E2E_CDP_MUST_BE_LOCAL");
    const socket = new WebSocket(url);
    await opened(socket);
    const cdp = new Cdp(socket);
    const attached = await cdp.send("Target.attachToTarget", { flatten: true, targetId });
    cdp.#sessionId = string(attached["sessionId"]);
    return cdp;
  }

  public onEvent(listener: CdpListener): void {
    this.#listeners.push(listener);
  }

  public async send(method: string, params: CdpResult = {}): Promise<CdpResult> {
    this.#nextId += 1;
    const id = this.#nextId;
    const { promise, reject, resolve } = Promise.withResolvers<CdpResult>();
    const timer = setTimeout(() => {
      this.#pending.delete(id);
      reject(new Error("E2E_CDP_COMMAND_TIMEOUT"));
    }, cdpTimeout);
    this.#pending.set(id, { reject, resolve, timer });
    this.#socket.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(this.#sessionId === undefined ? {} : { sessionId: this.#sessionId }),
      }),
    );
    return promise;
  }

  public async authenticator(): Promise<string> {
    await this.send("WebAuthn.enable", { enableUI: false });
    const result = await this.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        automaticPresenceSimulation: true,
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        protocol: "ctap2",
        transport: "internal",
      },
    });
    return string(result["authenticatorId"]);
  }

  public close(): void {
    for (const request of this.#pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("E2E_CDP_CLOSED"));
    }
    this.#pending.clear();
    this.#socket.close();
  }

  #receive(raw: unknown): void {
    if (typeof raw !== "string") {
      return;
    }
    const data = object(JSON.parse(raw) as unknown);
    const { id, method } = data;
    if (typeof id === "number") {
      this.#settle(id, data);
    } else if (typeof method === "string" && data["sessionId"] === this.#sessionId) {
      for (const listener of this.#listeners) {
        listener(method, object(data["params"]));
      }
    }
  }

  #settle(id: number, data: Readonly<CdpResult>): void {
    const pending = this.#pending.get(id);
    if (pending === undefined) {
      return;
    }
    this.#pending.delete(id);
    clearTimeout(pending.timer);
    if (data["error"] === undefined) {
      pending.resolve(object(data["result"]));
    } else {
      pending.reject(new Error("E2E_CDP_COMMAND_FAILED"));
    }
  }
}

type CdpSession = Readonly<Pick<Cdp, keyof Cdp>>;

export { Cdp };
export type { CdpSession };
