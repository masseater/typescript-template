import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { McpGrants } from "#shared/contracts/index.ts";

import type { MemberMcpCapability } from "@repo/config";

type McpGrantView = Readonly<{ capabilities: readonly MemberMcpCapability[] }>;

async function loadMcpGrants(): Promise<McpGrantView> {
  const { api } = await userClient();
  return apiData(McpGrants, await api.mcp.grants.get());
}

async function saveMcpGrants(capabilities: readonly MemberMcpCapability[]): Promise<McpGrantView> {
  const { api } = await userClient();
  return apiData(McpGrants, await api.mcp.grants.put({ capabilities: [...capabilities] }));
}

export { loadMcpGrants, saveMcpGrants };
export type { McpGrantView };
