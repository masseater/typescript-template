import { accountIdSchema, apiTokenSchema, databaseIdSchema } from "./remote-input.ts";
import { array, literal, object, safeParse, strictObject, unknown } from "valibot";
import type { DatabaseExecutor } from "./remote-operations.ts";

const REQUEST_TIMEOUT_MS = 30_000;

const configSchema = strictObject({
  accountId: accountIdSchema,
  apiToken: apiTokenSchema,
  databaseId: databaseIdSchema,
});
const queryResultSchema = object({ results: array(unknown()), success: literal(true) });
const batchResponseSchema = object({
  result: array(queryResultSchema),
  success: literal(true),
});

function remoteExecutor(input: unknown): DatabaseExecutor {
  const parsed = safeParse(configSchema, input);
  if (!parsed.success) {
    throw new Error("REMOTE_INPUT_INVALID");
  }
  const { accountId, databaseId, apiToken } = parsed.output;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  return {
    async batch(queries) {
      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify({ batch: queries }),
          headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new Error("failed");
        }
        const result = safeParse(batchResponseSchema, await response.json());
        if (!result.success || result.output.result.length !== queries.length) {
          throw new Error("failed");
        }
        return result.output.result.map((item) => item.results);
      } catch {
        throw new Error("REMOTE_QUERY_FAILED");
      }
    },
  };
}

export { remoteExecutor };
