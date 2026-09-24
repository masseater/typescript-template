import { constants, homedir, tmpdir } from "node:os";

const homeDirectory = (): string => homedir();

const temporaryDirectory = (): string => tmpdir();

const signalNumber = (signal: NodeJS.Signals): number => constants.signals[signal];

export { homeDirectory, signalNumber, temporaryDirectory };
