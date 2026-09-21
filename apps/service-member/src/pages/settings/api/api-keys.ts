import { requireSuccess } from "@repo/auth-ui";
import { createIsomorphicFn } from "@tanstack/react-start";

import { memberAuthClient } from "#shared/auth/index.ts";

type ListedApiKey = Readonly<{
  createdAt: Date;
  id: string;
  name: string | null;
  start: string | null;
}>;

type CreatedApiKey = ListedApiKey & Readonly<{ key: string }>;

type AuthRequest = Readonly<{ baseURL: string; cookie: string }>;

type ApiKeyRow = Readonly<{
  createdAt: Date | string;
  id: string;
  name: string | null;
  start: string | null;
}>;

function listedFrom(apiKeys: readonly ApiKeyRow[]): readonly ListedApiKey[] {
  return apiKeys.map((entry) => ({
    createdAt: new Date(entry.createdAt),
    id: entry.id,
    name: entry.name,
    start: entry.start,
  }));
}

async function listKeys(request: AuthRequest | undefined): Promise<readonly ListedApiKey[]> {
  const listed = requireSuccess(
    await memberAuthClient.apiKey.list(
      request === undefined
        ? {}
        : {
            fetchOptions: {
              baseURL: request.baseURL,
              headers: { cookie: request.cookie },
            },
          },
    ),
  );
  return listedFrom(listed.apiKeys);
}

const loadApiKeys = createIsomorphicFn()
  .server(async (): Promise<readonly ListedApiKey[]> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const current = getRequest();
    return listKeys({
      baseURL: `${new URL(current.url).origin}/api/auth`,
      cookie: current.headers.get("cookie") ?? "",
    });
  })
  .client(async (): Promise<readonly ListedApiKey[]> => listKeys(undefined));

async function createApiKey(name: string): Promise<CreatedApiKey> {
  const created = requireSuccess(
    await memberAuthClient.apiKey.create({
      name,
    }),
  );
  return {
    createdAt: new Date(created.createdAt),
    id: created.id,
    key: created.key,
    name: created.name,
    start: created.start,
  };
}

async function revokeApiKey(keyId: string): Promise<void> {
  requireSuccess(await memberAuthClient.apiKey.delete({ keyId }));
}

export { createApiKey, loadApiKeys, revokeApiKey };
export type { CreatedApiKey, ListedApiKey };
