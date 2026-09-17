import * as v from "valibot";
import type { DatabaseExecutor } from "./remote-operations.ts";

const configSchema = v.strictObject({
  accountId: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
  databaseId: v.pipe(
    v.string(),
    v.uuid(),
    v.check((value) => !value.startsWith("00000000-")),
  ),
  apiToken: v.pipe(v.string(), v.minLength(20), v.regex(/^[A-Za-z0-9_-]+$/)),
});

export function remoteExecutor(input: unknown): DatabaseExecutor {
  const parsed = v.safeParse(configSchema, input);
  if (!parsed.success) throw new Error("REMOTE_INPUT_INVALID");
  const { accountId, databaseId, apiToken } = parsed.output;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  return {
    async batch(queries) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
          body: JSON.stringify({ batch: queries }),
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("failed");
        const result = v.safeParse(
          v.object({
            success: v.literal(true),
            result: v.array(v.object({ success: v.literal(true), results: v.array(v.unknown()) })),
          }),
          await response.json(),
        );
        if (!result.success || result.output.result.length !== queries.length)
          throw new Error("failed");
        return result.output.result.map((item) => item.results);
      } catch {
        throw new Error("REMOTE_QUERY_FAILED");
      }
    },
  };
}
