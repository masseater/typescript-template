import { constants, homedir, tmpdir } from "node:os";

const homeDirectory = (): string => homedir();

const temporaryDirectory = (): string => tmpdir();

const signalNumber = (signal: NodeJS.Signals): number => constants.signals[signal];

const isSignalName = (spelled: string): spelled is NodeJS.Signals =>
  Object.hasOwn(constants.signals, spelled);

export { homeDirectory, isSignalName, signalNumber, temporaryDirectory };
