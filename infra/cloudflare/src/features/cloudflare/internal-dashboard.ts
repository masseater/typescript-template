import { Stack } from "alchemy";

import { applicationProgram } from "./app.ts";
import { stackName, stackOptions } from "./stacks.ts";

export default Stack(
  stackName("internal-dashboard"),
  stackOptions,
  applicationProgram("internal-dashboard"),
);
