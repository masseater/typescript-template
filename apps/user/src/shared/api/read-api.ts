import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { decodeJson } from "@template/runtime/client";
import { getRequest } from "@tanstack/react-start/server";

type Contract = Parameters<typeof decodeJson>[0];

const fetchApi = createIsomorphicFn()
  .client(async (path: string) => fetch(path, { cache: "no-store", credentials: "same-origin" }))
  .server(async (path: string) => {
    const request = getRequest();
    const context = getGlobalStartContext();
    if (context === undefined) {
      throw new Error("リクエストの外では API を呼べません。");
    }
    return context.fetchApi(new Request(new URL(path, request.url), { headers: request.headers }));
  });

async function decodeReply<Shape extends Contract>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  reply: Response,
  contract: Shape,
): Promise<Shape["Type"]> {
  if (!reply.ok) {
    throw new Error(`取得に失敗しました（HTTP ${reply.status}）。`);
  }
  const body: unknown = await reply.json();
  return decodeJson(contract, body);
}

async function readApi<Shape extends Contract>(
  path: string,
  contract: Shape,
): Promise<Shape["Type"]> {
  return decodeReply(await fetchApi(path), contract);
}

async function findApi<Shape extends Contract>(
  path: string,
  contract: Shape,
  absentStatus: number,
): Promise<Shape["Type"] | undefined> {
  const reply = await fetchApi(path);
  return reply.status === absentStatus ? undefined : decodeReply(reply, contract);
}

const absence = { notFound: 404, unauthorized: 401 } as const;

export { absence, findApi, readApi };
