import { apiKey } from "@better-auth/api-key";
import {
  memberApiKeyRateLimitMax,
  memberApiKeyRateLimitWindowMilliseconds,
  memberApiKeyReadPermissions,
} from "@repo/config";

const memberApiKeyPlugin = () =>
  apiKey({
    enableSessionForAPIKeys: false,
    permissions: { defaultPermissions: memberApiKeyReadPermissions },
    rateLimit: {
      maxRequests: memberApiKeyRateLimitMax,
      timeWindow: memberApiKeyRateLimitWindowMilliseconds,
    },
  });

export { memberApiKeyPlugin };
