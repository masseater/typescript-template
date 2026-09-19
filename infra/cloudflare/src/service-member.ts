import { Stack } from "alchemy";

import { applicationProgram } from "./app.ts";
import { stackName, stackOptions } from "./stacks.ts";

// oxlint-disable-next-line import/no-default-export
export default Stack(
  stackName("service-member"),
  stackOptions,
  applicationProgram("service-member"),
);
