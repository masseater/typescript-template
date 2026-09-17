import type { AssetFetcher } from "@template/config";
import { developmentServer } from "@template/config/mode";
import { CurrentRequest, readBoundedText, reportFailure } from "@template/observability";
import { Cause, Context, Effect, Exit, Schema } from "effect";
import { Elysia } from "elysia";
import type { AnyElysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

export class RequestRejected extends Schema.TaggedError<RequestRejected>()("RequestRejected", {
  reason: Schema.Literals([
    "origin_denied",
    "json_required",
    "body_required",
    "body_too_large",
    "invalid_json",
  ]),
}) {}

export class InputInvalid extends Schema.TaggedError<InputInvalid>()("InputInvalid", {}) {}

export type Failure = { readonly status: number; readonly message: string };
export type FailureTable<E extends { readonly _tag: string }> = {
  readonly [K in E["_tag"]]:
    | Failure
    | "unexpected"
    | ((error: Extract<E, { readonly _tag: K }>) => Failure);
};

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";

const rejection: Record<RequestRejected["reason"], number> = {
  origin_denied: 403,
  json_required: 415,
  body_required: 400,
  body_too_large: 413,
  invalid_json: 400,
};

type CommonFailure =
  | RequestRejected
  | InputInvalid
  | { readonly _tag: "SessionRequired" }
  | { readonly _tag: "SessionInvalid" }
  | { readonly _tag: "AdminRequired" }
  | { readonly _tag: "AdminMfaRequired" };

const commonFailures: FailureTable<CommonFailure> = {
  RequestRejected: (error) => ({
    status: rejection[error.reason],
    message: error.reason === "invalid_json" ? invalidInput : forbidden,
  }),
  InputInvalid: { status: 400, message: invalidInput },
  SessionRequired: { status: 401, message: "ログインしてください。" },
  SessionInvalid: { status: 403, message: forbidden },
  AdminRequired: { status: 403, message: forbidden },
  AdminMfaRequired: { status: 403, message: forbidden },
};

export const privateHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export const jsonResponse = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: privateHeaders });

export function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export class Assets extends Context.Service<Assets, AssetFetcher>()("@template/runtime/Assets") {}

export class AppOrigin extends Context.Service<AppOrigin, string>()(
  "@template/runtime/AppOrigin",
) {}

export const readJsonBody = <S extends Decodable>(schema: S, request: Request) =>
  Effect.gen(function* () {
    const origin = yield* AppOrigin;
    if (
      request.headers.get("origin") !== origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return yield* new RequestRejected({ reason: "origin_denied" });
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
      return yield* new RequestRejected({ reason: "json_required" });
    const body = yield* readBoundedText(request, 16384);
    if (body.kind === "missing") return yield* new RequestRejected({ reason: "body_required" });
    if (body.kind === "too_large") return yield* new RequestRejected({ reason: "body_too_large" });
    const input = yield* Effect.try({
      try: (): unknown => JSON.parse(body.text),
      catch: () => new RequestRejected({ reason: "invalid_json" }),
    });
    return yield* decodeInput(schema, input);
  });

export const readSearchParams = <S extends Decodable>(schema: S, request: Request) =>
  decodeInput(schema, Object.fromEntries(new URL(request.url).searchParams));

type Decodable = Schema.Top & { readonly DecodingServices: never };

const decodeInput = <S extends Decodable>(schema: S, input: unknown) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => new InputInvalid()),
  );

const FailureShape = Schema.Struct({ status: Schema.Int, message: Schema.String });

const toFailure = (table: object, error: { readonly _tag: string }) => {
  const entry: unknown = Reflect.get(table, error._tag);
  const failure: unknown =
    typeof entry === "function" ? Reflect.apply(entry, undefined, [error]) : entry;
  return Schema.is(FailureShape)(failure) ? failure : undefined;
};

export const createApi = () =>
  developmentServer ? new Elysia({ aot: false }) : new Elysia({ adapter: CloudflareAdapter });

export const compileApi = <App extends AnyElysia>(app: App): App =>
  developmentServer ? app : app.compile();

export const apiBridge = <R>() => {
  const pending = new WeakMap<
    Request,
    { readonly context: Context.Context<R | CurrentRequest>; readonly request: Request }
  >();

  const dispatch = (app: AnyElysia, request: Request) =>
    Effect.gen(function* () {
      const routed = new Request(request.url, { method: request.method, headers: request.headers });
      pending.set(routed, { context: yield* Effect.context<R | CurrentRequest>(), request });
      const response = yield* Effect.promise(async (): Promise<Response> => app.fetch(routed));
      return secureResponse(response);
    });

  const raw =
    <E extends { readonly _tag: string }>(
      handler: (request: Request) => Effect.Effect<Response, E, R | CurrentRequest>,
      failures: FailureTable<Exclude<E, CommonFailure>>,
    ) =>
    ({ request }: { readonly request: Request }): Promise<Response> => {
      const entry = pending.get(request);
      if (entry === undefined)
        return Promise.resolve(jsonResponse({ error: "処理に失敗しました。" }, 500));
      const { context } = entry;
      const program = handler(entry.request).pipe(
        Effect.catchCause((cause) => {
          const error = Cause.findErrorOption(cause);
          const failure =
            error._tag === "Some"
              ? toFailure({ ...commonFailures, ...failures }, error.value)
              : undefined;
          return failure === undefined
            ? reportFailure(cause).pipe(
                Effect.as(
                  jsonResponse(
                    { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
                    500,
                  ),
                ),
              )
            : Effect.succeed(jsonResponse({ error: failure.message }, failure.status));
        }),
      );
      return Effect.runPromiseExit(Effect.provide(program, context)).then((exit) =>
        Exit.isSuccess(exit) ? exit.value : jsonResponse({ error: "処理に失敗しました。" }, 500),
      );
    };

  const route = <A, E extends { readonly _tag: string }>(
    response: Schema.Codec<A, unknown>,
    handler: (request: Request) => Effect.Effect<A, E, R | CurrentRequest>,
    failures: FailureTable<Exclude<E, CommonFailure>>,
  ) =>
    raw(
      (request) =>
        handler(request).pipe(
          Effect.flatMap((value) => Schema.encodeEffect(response)(value).pipe(Effect.orDie)),
          Effect.map((body) => jsonResponse(body)),
        ),
      failures,
    );

  return { dispatch, route, raw };
};
