// @effect-diagnostics-next-line nodeBuiltinImport:off
import { execFileSync } from "node:child_process";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from "node:crypto";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  // @effect-diagnostics-next-line nodeBuiltinImport:off
} from "node:fs";
import { isBuiltin } from "node:module";

export interface HostDirectoryEntry {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface HostFileStatus {
  readonly size: number;
  readonly mtimeMs: number;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface Sha256Digest {
  update(chunk: string | Uint8Array): Sha256Digest;
  digest(encoding: "hex"): string;
}

export type CapturedCommand = {
  readonly command: string;
  readonly commandArguments: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly input?: string | undefined;
};

export const textAt = (filePath: string): string => readFileSync(filePath, "utf8");

export const bytesAt = (filePath: string): Uint8Array => readFileSync(filePath);

export const nativeRealPathOf = (filePath: string): string => realpathSync.native(filePath);

export const walkedRealPathOf = (filePath: string): string => realpathSync(filePath);

export const statusAt = (filePath: string): HostFileStatus => statSync(filePath);

export const linkStatusAt = (filePath: string): HostFileStatus => lstatSync(filePath);

export const linkTargetAt = (filePath: string): string => readlinkSync(filePath);

export const isPresentAt = (filePath: string): boolean => existsSync(filePath);

export const demandExecutableAt = (filePath: string): void => {
  accessSync(filePath, constants.X_OK);
};

export const childNamesIn = (directory: string): readonly string[] => readdirSync(directory);

export const childEntriesIn = (directory: string): readonly HostDirectoryEntry[] =>
  readdirSync(directory, { withFileTypes: true });

export const createDirectoryTree = (directory: string): void => {
  mkdirSync(directory, { recursive: true });
};

export const openForAppending = (filePath: string): number => openSync(filePath, "a");

export const closeDescriptor = (descriptor: number): void => {
  closeSync(descriptor);
};

export const writeTextAt = (filePath: string, writtenText: string): void => {
  writeFileSync(filePath, writtenText, "utf8");
};

export const movePath = (fromPath: string, toPath: string): void => {
  renameSync(fromPath, toPath);
};

export const removeFileAt = (filePath: string): void => {
  rmSync(filePath);
};

export const startSha256 = (): Sha256Digest => createHash("sha256");

export const capturedStdoutOf = (invocation: CapturedCommand): string =>
  execFileSync(invocation.command, [...invocation.commandArguments], {
    cwd: invocation.cwd,
    encoding: "utf8",
    env: invocation.env,
    input: invocation.input,
    stdio: [invocation.input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
  });

export const namesBuiltinModule = (specifier: string): boolean => isBuiltin(specifier);
