import { authorizeMcpAs } from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const mcpChallenge = () => authorizeMcpAs({ application: APPLICATION.serviceAdmin }, authorizeMcpRequest);

export { mcpChallenge };
