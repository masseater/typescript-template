import { requireSuccess } from "@repo/auth-ui";
import { memberApiKeyReadPermissions } from "@repo/config";
import { DateTime } from "effect";

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

type ApiKeyRow = Readonly<{
  createdAt: Date | string;
  id: string;
  name: string | null;
  start: string | null;
}>;

function dateOf(value: Date | string): Date {
  return typeof value === "string" ? DateTime.toDate(DateTime.makeUnsafe(value)) : value;
}

function listedFrom(apiKeys: readonly ApiKeyRow[]): readonly ListedApiKey[] {
  return apiKeys.map((entry) => ({
    createdAt: dateOf(entry.createdAt),
    id: entry.id,
    name: entry.name,
    start: entry.start,
  }));
}

function loadApiKeys(): Promise<readonly ListedApiKey[]> {
  return memberAuthClient.apiKey
    .list({})
    .then((listed) => listedFrom(requireSuccess(listed).apiKeys));
}

function createApiKey(name: string, choice: ApiKeyChoice): Promise<CreatedApiKey> {
  const profile = choice.profileUpdate
    ? ["read", "update"]
    : [...memberApiKeyReadPermissions.profile];
  return memberAuthClient.apiKey
    .create({
      name,
      permissions: {
        members: [...memberApiKeyReadPermissions.members],
        ...(choice.messageSend ? { messages: ["send"] } : {}),
        profile,
      },
    })
    .then((createdRaw) => {
      const created = requireSuccess(createdRaw);
      return {
        createdAt: dateOf(created.createdAt),
        id: created.id,
        key: created.key,
        name: created.name,
        start: created.start,
      };
    });
}

function revokeApiKey(keyId: string): Promise<void> {
  return memberAuthClient.apiKey.delete({ keyId }).then((result) => {
    requireSuccess(result);
  });
}

export { createApiKey, loadApiKeys, revokeApiKey };
export type { CreatedApiKey, ListedApiKey };
