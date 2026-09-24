import { applicationProgram } from "@repo/infra-cloudflare/application";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";

export default prefixedStack("internal-dashboard", applicationProgram("internal-dashboard"));
