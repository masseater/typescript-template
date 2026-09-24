import { coreProgram } from "@repo/infra-cloudflare/core-program";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";

export default prefixedStack("core", coreProgram());
