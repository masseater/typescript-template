import { requireSuccess } from "@repo/auth-ui";
import { memberApiKeyReadPermissions } from "@repo/config";

import { memberAuthClient } from "#shared/auth/index.ts";

type ListedApiKey = Readonly<{
  createdAt: Date;
  id: string;
  name: string | null;
  start: string | null;
}>;

type CreatedApiKey = ListedApiKey & Readonly<{ key: string }>;

type ApiKeyChoice = Readonly<{
  messageSend: boolean;
  profileUpdate: boolean;
}>;

async function loadApiKeys(): Promise<readonly ListedApiKey[]> {
  const listed = requireSuccess(await memberAuthClient.apiKey.list({}));
  return listed.apiKeys.map((entry) => ({
    createdAt: new Date(entry.createdAt),
    id: entry.id,
    name: entry.name,
    start: entry.start,
  }));
}

async function createApiKey(name: string, choice: ApiKeyChoice): Promise<CreatedApiKey> {
  const profile = choice.profileUpdate
    ? ["read", "update"]
    : [...memberApiKeyReadPermissions.profile];
  const created = requireSuccess(
    await memberAuthClient.apiKey.create({
      name,
      permissions: {
        ...memberApiKeyReadPermissions,
        ...(choice.messageSend ? { messages: ["send"] } : {}),
        profile,
      },
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
