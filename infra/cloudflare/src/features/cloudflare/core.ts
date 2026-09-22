import { Stack } from "alchemy";

import { coreProgram } from "./core-program.ts";
import { stackName, stackOptions } from "./stacks.ts";

export default Stack(stackName("core"), stackOptions, coreProgram());
