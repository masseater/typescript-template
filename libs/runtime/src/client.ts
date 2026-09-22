import { treaty } from "@elysia/eden";
import { httpStatus } from "@repo/config";
import { Result, Schema } from "effect";

import { ErrorBody } from "./contracts.ts";

import type { AnyElysia } from "elysia";
type ApiReply = {
  readonly data: unknown;
  readonly error: {
    readonly status: number;
    readonly value: unknown;
  } | null;
  readonly response: Readonly<Pick<Response, "headers">>;
};
type Decodable = Schema.Top & {
  readonly DecodingServices: never;
};
const decodeJson = <Contract extends Decodable>(
  contract: Contract,
  input: unknown,
): Contract["Type"] => {
  const decoded = Schema.decodeUnknownResult(contract)(input);
  if (Result.isFailure(decoded)) {
    throw new Error("サーバーの応答形式が不正です。");
  }
  return decoded.success;
};
const failureMessage = (
  answered: Readonly<Pick<Response, "headers" | "status">>,
  requestBody: unknown,
): string => {
  const failure = Schema.decodeUnknownResult(ErrorBody)(requestBody);
  const logMessage = Result.isSuccess(failure)
    ? failure.success.error
    : `リクエストに失敗しました（HTTP ${answered.status}）。`;
  const requestId = answered.headers.get("x-request-id") ?? "";
  return requestId === "" ? logMessage : `${logMessage} リクエスト ID: ${requestId}`;
};
const apiData = <Contract extends Decodable>(
  contract: Contract,
  answered: ApiReply,
): Contract["Type"] => {
  if (answered.error !== null) {
    throw new Error(
      failureMessage(
        { headers: answered.response.headers, status: answered.error.status },
        answered.error.value,
      ),
    );
  }
  return decodeJson(contract, answered.data);
};
const absent = {
  notFound: httpStatus.notFound,
  unauthorized: httpStatus.unauthorized,
} as const;
const apiDataOrNone = <Contract extends Decodable>(
  contract: Contract,
  answered: ApiReply,
): Contract["Type"] | undefined => {
  return answered.error?.status === absent.unauthorized ? undefined : apiData(contract, answered);
};
const apiDataOrNoneFor = (absentStatus: (typeof absent)[keyof typeof absent]) => {
  return <Contract extends Decodable>(
    contract: Contract,
    answered: ApiReply,
  ): Contract["Type"] | undefined => {
    return answered.error?.status === absentStatus ? undefined : apiData(contract, answered);
  };
};
const apiServerClient = <App extends AnyElysia>(
  app: App,
  headers: Readonly<Record<string, string>>,
): ReturnType<typeof treaty<App, string>> => {
  return treaty(app, { headers, parseDate: false });
};
const apiClient = <App extends AnyElysia>(): ReturnType<typeof treaty<App>> => {
  return treaty<App>(globalThis.location.origin, {
    fetch: { cache: "no-store", credentials: "same-origin", redirect: "error" },
    parseDate: false,
  });
};
export {
  absent,
  apiClient,
  apiData,
  apiDataOrNone,
  apiDataOrNoneFor,
  apiServerClient,
  decodeJson,
  failureMessage,
};
