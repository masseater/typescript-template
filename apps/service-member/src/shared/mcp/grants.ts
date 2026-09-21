import { type MemberMcpCapability } from "@repo/config";
import { query, schema } from "@repo/db";
import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";

const { memberMcpGrant } = schema;

class McpGrantRequired extends Data.TaggedError("McpGrantRequired")<{
  readonly capability: MemberMcpCapability;
}> {}

const listMcpGrants = Effect.fn("listMcpGrants")(function* listMcpGrants(memberId: string) {
  const rows = yield* query((database) =>
    database
      .select({ capability: memberMcpGrant.capability })
      .from(memberMcpGrant)
      .where(eq(memberMcpGrant.memberId, memberId)),
  );
  return rows.map((row) => row.capability);
});

const replaceMcpGrants = Effect.fn("replaceMcpGrants")(function* replaceMcpGrants(
  memberId: string,
  capabilities: readonly MemberMcpCapability[],
) {
  const unique = [...new Set(capabilities)];
  yield* query((database) =>
    database.delete(memberMcpGrant).where(eq(memberMcpGrant.memberId, memberId)),
  );
  if (unique.length > 0) {
    yield* query((database) =>
      database.insert(memberMcpGrant).values(
        unique.map((capability) => ({
          capability,
          memberId,
        })),
      ),
    );
  }
  return unique;
});

const requireMcpGrant = Effect.fn("requireMcpGrant")(function* requireMcpGrant(
  memberId: string,
  capability: MemberMcpCapability,
) {
  const granted = yield* listMcpGrants(memberId);
  if (!granted.includes(capability)) {
    return yield* new McpGrantRequired({ capability });
  }
});

export { McpGrantRequired, listMcpGrants, replaceMcpGrants, requireMcpGrant };
