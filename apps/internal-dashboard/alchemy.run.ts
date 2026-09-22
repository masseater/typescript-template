import { applicationProgram } from "@repo/infra-cloudflare/application";
import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { Stack } from "alchemy";

export default Stack(
  stackName("internal-dashboard"),
  stackOptions,
  applicationProgram("internal-dashboard"),
);
