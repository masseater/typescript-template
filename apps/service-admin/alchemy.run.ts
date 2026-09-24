import { applicationProgram } from "@repo/infra-cloudflare/application";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";

export default prefixedStack("service-admin", applicationProgram("service-admin"));
