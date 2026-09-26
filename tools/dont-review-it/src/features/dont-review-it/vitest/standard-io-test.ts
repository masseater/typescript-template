import { test, vi } from "vite-plus/test";

import { PROCESS_IO_MEMBER } from "../lint/oxlint/rules/mutation-and-failure/no-logged-and-continued-failure--stop-or-recover.ts";

/** @public */
export type CapturedStream = {
  readonly chunks: readonly string[];
  readonly text: () => string;
};

const decoded = (writtenFragment: string | Uint8Array): string =>
  typeof writtenFragment === "string" ? writtenFragment : new TextDecoder().decode(writtenFragment);

const capturedWrites = (stream: NodeJS.WriteStream): CapturedStream => {
  const spy = vi.spyOn(stream, PROCESS_IO_MEMBER.write).mockImplementation(() => true);
  const written = (): readonly string[] =>
    spy.mock.calls.map(([writtenFragment]) => decoded(writtenFragment));
  const captured = {
    get chunks(): readonly string[] {
      return written();
    },
    text: (): string => written().join(""),
  };
  Object.defineProperty(captured, "text", { enumerable: false });
  return captured;
};

/** @public */
export const standardIoTest = test
  .extend("stdout", { auto: true }, () => capturedWrites(process.stdout))
  .extend("stderr", { auto: true }, () => capturedWrites(process.stderr));

export type StandardIoTest = typeof standardIoTest;
