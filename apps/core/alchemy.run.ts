import { coreProgram } from "@repo/infra-cloudflare/core-program";
import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { Stack } from "alchemy";

export default Stack(stackName("core"), stackOptions, coreProgram());
