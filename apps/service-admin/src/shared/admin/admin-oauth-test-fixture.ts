import { authorizeMcpAs } from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const mcpChallenge = () => authorizeMcpAs(APPLICATION.admin, authorizeMcpRequest);

export { mcpChallenge };
