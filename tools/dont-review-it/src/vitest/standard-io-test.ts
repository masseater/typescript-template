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

  return Object.create(Object.prototype, {
    chunks: { enumerable: true, get: written },
    text: { enumerable: false, value: () => written().join("") },
  }) as CapturedStream;
};

const standardIoTestOf = () =>
  test
    .extend("stdout", { auto: true }, () => capturedWrites(process.stdout))
    .extend("stderr", { auto: true }, () => capturedWrites(process.stderr));

type StandardIoTest = ReturnType<typeof standardIoTestOf>;

let loaded: StandardIoTest | undefined;

const loadStandardIoTest = (): StandardIoTest => {
  loaded ??= standardIoTestOf();
  return loaded;
};

const forward = (property: PropertyKey): unknown => {
  const api = loadStandardIoTest();
  const value: unknown = Reflect.get(api, property);
  return typeof value === "function" ? value.bind(api) : value;
};

const unbound = (() => undefined) as unknown as StandardIoTest;

/** @public */
export const standardIoTest: StandardIoTest = new Proxy(unbound, {
  apply(_target, thisArgument, argumentsList) {
    const api = loadStandardIoTest() as (...args: unknown[]) => unknown;
    return Reflect.apply(api, thisArgument, argumentsList);
  },
  get(_target, property) {
    return forward(property);
  },
});
