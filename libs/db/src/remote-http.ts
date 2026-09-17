import { array, literal, object, safeParse, unknown } from "valibot";
import type { DatabaseExecutor } from "./remote-operations.ts";

const REQUEST_TIMEOUT_MS = 30_000;

const queryResultSchema = object({ results: array(unknown()), success: literal(true) });
const batchResponseSchema = object({
  result: array(queryResultSchema),
  success: literal(true),
});

function remoteExecutor({
  accountId,
  apiToken,
  databaseId,
}: Readonly<{ accountId: string; apiToken: string; databaseId: string }>): DatabaseExecutor {
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
        return result.output.result.map(
          (item: Readonly<{ results: readonly unknown[] }>) => item.results,
        );
      } catch {
        throw new Error("REMOTE_QUERY_FAILED");
      }
    },
  };
}

export { remoteExecutor };
