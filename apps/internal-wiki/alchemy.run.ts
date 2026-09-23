import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { wikiProgram } from "@repo/infra-cloudflare/wiki-program";
import { Stack } from "alchemy";

export default Stack(stackName("internal-wiki"), stackOptions, wikiProgram());
