import { apiKey } from "@better-auth/api-key";
import {
  memberApiKeyRateLimitMax,
  memberApiKeyRateLimitWindowMilliseconds,
  memberApiKeyReadPermissions,
} from "@repo/config";

const memberApiKeyPlugin = (): ReturnType<typeof apiKey> =>
  apiKey({
    enableSessionForAPIKeys: false,
    permissions: { defaultPermissions: memberApiKeyReadPermissions },
    rateLimit: {
      maxRequests: memberApiKeyRateLimitMax,
      timeWindow: memberApiKeyRateLimitWindowMilliseconds,
    },
  });

export { memberApiKeyPlugin };
