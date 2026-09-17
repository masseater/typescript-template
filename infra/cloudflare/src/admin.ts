import { stackName, stackOptions } from "./stacks.ts";
import { Stack } from "alchemy";
import { applicationProgram } from "./app.ts";

// oxlint-disable-next-line import/no-default-export
export default Stack(stackName("admin"), stackOptions, applicationProgram("admin"));
