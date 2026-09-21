import { memberMcpCapabilities, type MemberMcpCapability } from "@repo/config";
import { Schema } from "effect";

const McpGrants = Schema.Struct({
  capabilities: Schema.Array(Schema.Literals(memberMcpCapabilities)),
});

export { McpGrants };
export type { MemberMcpCapability };
