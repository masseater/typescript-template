import { authorizeMcpAs } from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const mcpRequest = (token?: string) =>
  authorizeMcpAs(
    { application: APPLICATION.wiki, ...(token === undefined ? {} : { token }) },
    authorizeMcpRequest,
  );

export { mcpRequest };
