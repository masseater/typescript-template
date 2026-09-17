import { Result, Schema } from "effect";
import type { AnyElysia } from "elysia";
import { ErrorBody } from "./contracts.ts";
import { httpStatus } from "@template/observability";
import { treaty } from "@elysiajs/eden";

type Decodable = Schema.Top & { readonly DecodingServices: never };

interface ApiFailure {
  readonly status: number;
  readonly value: unknown;
}

interface ApiReply {
  readonly data: unknown;
  readonly error: ApiFailure | null;
  readonly response: Readonly<Pick<Response, "headers">>;
}

function decodeJson<Contract extends Decodable>(
  contract: Contract,
  input: unknown,
): Contract["Type"] {
  const decoded = Schema.decodeUnknownResult(contract)(input);
  if (Result.isFailure(decoded)) {
    throw new Error("サーバーの応答形式が不正です。");
  }
  return decoded.success;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function failureMessage(reply: ApiReply, failure: ApiFailure): string {
  const body = Schema.decodeUnknownResult(ErrorBody)(failure.value);
  const message = Result.isSuccess(body)
    ? body.success.error
    : `リクエストに失敗しました（HTTP ${failure.status}）。`;
  const requestId = reply.response.headers.get("x-request-id") ?? "";
  return requestId === "" ? message : `${message} リクエスト ID: ${requestId}`;
}

function apiData<Contract extends Decodable>(
  contract: Contract,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  reply: ApiReply,
): Contract["Type"] {
  if (reply.error !== null) {
    throw new Error(failureMessage(reply, reply.error));
  }
  return decodeJson(contract, reply.data);
}

function apiDataOrNone<Contract extends Decodable>(
  contract: Contract,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  reply: ApiReply,
): Contract["Type"] | undefined {
  return reply.error?.status === httpStatus.unauthorized ? undefined : apiData(contract, reply);
}

function apiServerClient<App extends AnyElysia>(
  app: App,
  headers: Readonly<Record<string, string>>,
): ReturnType<typeof treaty<App, string>> {
  return treaty(app, { headers, parseDate: false });
}

function apiClient<App extends AnyElysia>(): ReturnType<typeof treaty<App>> {
  return treaty<App>(globalThis.location.origin, {
    fetch: { cache: "no-store", credentials: "same-origin", redirect: "error" },
    parseDate: false,
  });
}

export { apiClient, apiData, apiDataOrNone, apiServerClient, decodeJson };
