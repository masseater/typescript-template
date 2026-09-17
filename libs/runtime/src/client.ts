import { Result, Schema } from "effect";
import { ErrorBody } from "./contracts.ts";

type Decodable = Schema.Top & { readonly DecodingServices: never };

interface JsonMutation {
  readonly body: unknown;
  readonly method: "PATCH" | "DELETE" | "POST";
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
function failureMessage(reply: Readonly<Response>, body: unknown): string {
  const failure = Schema.decodeUnknownResult(ErrorBody)(body);
  const message = Result.isSuccess(failure)
    ? failure.success.error
    : `リクエストに失敗しました（HTTP ${reply.status}）。`;
  const requestId = reply.headers.get("x-request-id") ?? "";
  return requestId === "" ? message : `${message} リクエスト ID: ${requestId}`;
}

async function send(path: string, mutation: JsonMutation | undefined): Promise<Response> {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new Error("同じアプリの API を指定してください。");
  }
  return fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    method: mutation?.method ?? "GET",
    redirect: "error",
    ...(mutation
      ? { body: JSON.stringify(mutation.body), headers: { "content-type": "application/json" } }
      : {}),
  });
}

async function requestJson<Contract extends Decodable>(
  path: string,
  contract: Contract,
  mutation?: JsonMutation,
): Promise<Contract["Type"]> {
  const reply = await send(path, mutation);
  const body: unknown = await reply.json();
  if (!reply.ok) {
    throw new Error(failureMessage(reply, body));
  }
  return decodeJson(contract, body);
}

export { decodeJson, requestJson };
