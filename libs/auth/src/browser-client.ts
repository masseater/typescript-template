import { Effect } from "effect";

import { Auth } from "./auth.ts";
import { verifySession } from "./session.ts";

interface JsonResponse {
  readonly body: unknown;
  readonly status: number;
}

const origins = {
  admin: "http://localhost:4102",
  user: "http://localhost:4101",
  wiki: "http://localhost:4103",
} as const;

class BrowserClient {
  public readonly cookies = new Map<string, string>();
  readonly #auth: Auth["Service"];
  readonly #network: Readonly<Record<string, string>>;

  public constructor(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    auth: Auth["Service"],
    network: Readonly<Record<string, string>> = {},
  ) {
    this.#auth = auth;
    this.#network = network;
  }

  public get origin(): string {
    return origins[this.#auth.audience];
  }

  public headers(): Headers {
    const cookie = [...this.cookies]
      .map(([key, value]: readonly [string, string]) => `${key}=${value}`)
      .join("; ");
    return new Headers({ ...this.#network, cookie, origin: this.origin });
  }

  public request(
    endpoint: string,
    body?: Readonly<Record<string, unknown>>,
  ): Effect.Effect<Response> {
    const headers = this.headers();
    headers.set("content-type", "application/json");
    return this.send(
      new Request(`${this.origin}/api/auth${endpoint}`, {
        headers,
        method: body ? "POST" : "GET",
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }

  public navigate(url: string): Effect.Effect<Response> {
    const headers = this.headers();
    headers.set("accept", "text/html");
    return this.send(new Request(url, { headers, redirect: "manual" }));
  }

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  public send(request: Request): Effect.Effect<Response> {
    return Effect.promise(async () => {
      const response = await this.#auth.instance.handler(request);
      for (const cookie of response.headers.getSetCookie()) {
        this.#storeCookie(cookie);
      }
      return response;
    });
  }

  public json(
    endpoint: string,
    body?: Readonly<Record<string, unknown>>,
  ): Effect.Effect<JsonResponse> {
    return this.request(endpoint, body).pipe(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      Effect.flatMap((response) =>
        Effect.promise(async (): Promise<JsonResponse> => ({
          body: await response.json(),
          status: response.status,
        })),
      ),
    );
  }

  // oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
  public verify(allowEnrollment = false) {
    return verifySession(this.headers(), allowEnrollment).pipe(
      Effect.provideService(Auth, this.#auth),
    );
  }

  #storeCookie(header: string): void {
    const [pair] = header.split(";");
    if (pair === undefined || pair === "") {
      return;
    }
    const separator = pair.indexOf("=");
    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value === "") {
      this.cookies.delete(key);
      return;
    }
    this.cookies.set(key, value);
  }
}

export { BrowserClient, origins };
