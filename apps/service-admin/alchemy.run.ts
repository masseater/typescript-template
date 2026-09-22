import { applicationProgram } from "@repo/infra-cloudflare/application";
import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { Stack } from "alchemy";

export default Stack(stackName("service-admin"), stackOptions, applicationProgram("service-admin"));
