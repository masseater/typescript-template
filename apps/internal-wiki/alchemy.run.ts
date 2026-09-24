import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";
import { wikiProgram } from "@repo/infra-cloudflare/wiki-program";

export default prefixedStack("internal-wiki", wikiProgram());
