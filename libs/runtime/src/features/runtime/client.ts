import { treaty } from "@elysia/eden";
import { httpStatus } from "@repo/config";
import { Result, Schema } from "effect";

import { ErrorBody } from "./contracts.ts";

import type { AnyElysia } from "elysia";

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

function failureMessage(
  reply: Readonly<Pick<Response, "headers" | "status">>,
  body: unknown,
): string {
  const failure = Schema.decodeUnknownResult(ErrorBody)(body);
  const message = Result.isSuccess(failure)
    ? failure.success.error
    : `リクエストに失敗しました（HTTP ${reply.status}）。`;
  const requestId = reply.headers.get("x-request-id") ?? "";
  return requestId === "" ? message : `${message} リクエスト ID: ${requestId}`;
}

function apiData<Contract extends Decodable>(
  contract: Contract,
  reply: ApiReply,
): Contract["Type"] {
  if (reply.error !== null) {
    throw new Error(
      failureMessage(
        { headers: reply.response.headers, status: reply.error.status },
        reply.error.value,
      ),
    );
  }
  return decodeJson(contract, reply.data);
}

const absent = {
  notFound: httpStatus.notFound,
  unauthorized: httpStatus.unauthorized,
} as const;

function apiDataOrNone<Contract extends Decodable>(
  contract: Contract,
  reply: ApiReply,
  absentStatus: (typeof absent)[keyof typeof absent] = absent.unauthorized,
): Contract["Type"] | undefined {
  return reply.error?.status === absentStatus ? undefined : apiData(contract, reply);
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

export { absent, apiClient, apiData, apiDataOrNone, apiServerClient, decodeJson, failureMessage };
