import { APPLICATION } from "@repo/config";
import { applicationProgram } from "@repo/infra-cloudflare/application";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";

export default prefixedStack(APPLICATION.serviceAdmin, applicationProgram(APPLICATION.serviceAdmin));
