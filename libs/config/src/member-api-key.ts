const memberApiKeyReadPermissions = {
  members: ["read"],
  profile: ["read"],
} as const;

const memberApiKeyRateLimitMax = 60;
const memberApiKeyRateLimitWindowMilliseconds = 60_000;
const memberApiKeyHeader = "x-api-key";

export {
  memberApiKeyHeader,
  memberApiKeyRateLimitMax,
  memberApiKeyRateLimitWindowMilliseconds,
  memberApiKeyReadPermissions,
};
