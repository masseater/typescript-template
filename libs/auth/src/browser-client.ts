import { Effect } from "effect";

import { Auth } from "./auth.ts";
import { verifySession } from "./session.ts";

type JsonReply = {
  readonly body: unknown;
  readonly status: number;
};

const origins = {
  admin: "http://localhost:4102",
  user: "http://localhost:4101",
  wiki: "http://localhost:4103",
} as const;

class BrowserClient {
  readonly #auth: Auth["Service"];
  readonly #cookies: Map<string, string>;
  readonly #network: Readonly<Record<string, string>>;

  public constructor(
    auth: Auth["Service"],
    initial: {
      readonly cookies?: ReadonlyMap<string, string>;
      readonly network?: Readonly<Record<string, string>>;
    } = {},
  ) {
    this.#auth = auth;
    this.#cookies = new Map(initial.cookies);
    this.#network = initial.network ?? {};
  }

  public get origin(): string {
    return origins[this.#auth.audience];
  }

  public cookieHeaders(): Headers {
    const cookie = [...this.#cookies]
      .map(([cookieName, cookieValue]: readonly [string, string]) => `${cookieName}=${cookieValue}`)
      .join("; ");
    return new Headers({ ...this.#network, cookie, origin: this.origin });
  }

  public request(
    endpoint: string,
    jsonFields?: Readonly<Record<string, unknown>>,
  ): Effect.Effect<Response> {
    return this.send(
      new Request(`${this.origin}/api/auth${endpoint}`, {
        headers: {
          ...Object.fromEntries(this.cookieHeaders()),
          "content-type": "application/json",
        },
        method: jsonFields ? "POST" : "GET",
        ...(jsonFields ? { body: JSON.stringify(jsonFields) } : {}),
      }),
    );
  }

  public status(
    endpoint: string,
    jsonFields?: Readonly<Record<string, unknown>>,
  ): Effect.Effect<number> {
    return this.request(endpoint, jsonFields).pipe(Effect.map((handled) => handled.status));
  }

  public navigate(url: string): Effect.Effect<Response> {
    return this.send(
      new Request(url, {
        headers: { ...Object.fromEntries(this.cookieHeaders()), accept: "text/html" },
        redirect: "manual",
      }),
    );
  }

  public send(outgoing: Request): Effect.Effect<Response> {
    return Effect.promise(async () => {
      const handled = await this.#auth.instance.handler(outgoing);
      for (const cookie of handled.headers.getSetCookie()) {
        this.#storeCookie(cookie);
      }
      return handled;
    });
  }

  public json(
    endpoint: string,
    jsonFields?: Readonly<Record<string, unknown>>,
  ): Effect.Effect<JsonReply> {
    return this.request(endpoint, jsonFields).pipe(
      Effect.flatMap((handled) =>
        Effect.promise(async (): Promise<JsonReply> => ({
          body: await handled.json(),
          status: handled.status,
        })),
      ),
    );
  }

  public verify(
    allowEnrollment?: boolean,
  ): Effect.Effect<
    Effect.Success<ReturnType<typeof verifySession>>,
    Effect.Error<ReturnType<typeof verifySession>>,
    Exclude<Effect.Services<ReturnType<typeof verifySession>>, Auth>
  > {
    return verifySession(this.cookieHeaders(), allowEnrollment).pipe(
      Effect.provideService(Auth, this.#auth),
    );
  }

  public transferTo(auth: Auth["Service"]): BrowserClient {
    const from = `template-${this.#auth.audience}`;
    const to = `template-${auth.audience}`;
    const cookies = new Map(
      [...this.#cookies].map(([cookieName, cookieValue]) => [
        cookieName.replaceAll(from, to),
        cookieValue,
      ]),
    );
    return new BrowserClient(auth, { cookies });
  }

  #storeCookie(header: string): void {
    const [pair] = header.split(";");
    if (pair === undefined || pair === "") {
      return;
    }
    const separator = pair.indexOf("=");
    const cookieName = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (cookieValue === "") {
      this.#cookies.delete(cookieName);
      return;
    }
    this.#cookies.set(cookieName, cookieValue);
  }
}

export { BrowserClient, origins };
