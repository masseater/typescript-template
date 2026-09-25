import { constants } from "node:os";

const signalNumber = (signal: NodeJS.Signals): number => constants.signals[signal];

const isSignalName = (spelled: string): spelled is NodeJS.Signals =>
  Object.hasOwn(constants.signals, spelled);

export { isSignalName, signalNumber };
