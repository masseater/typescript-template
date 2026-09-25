import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness-test-fixture.ts";

const probeFile = "libs/ui/src/features/ui/shared/ui/probe.tsx";

const settersInEffects = [
  [
    "local state in a layout effect",
    'import { useLayoutEffect } from "react"; import { localState } from "../../local-state"; const usePanel = localState(null); export const Probe = ({ children }) => { const [, setPanel] = usePanel(); useLayoutEffect(() => { setPanel(children); return () => { setPanel(null); }; }, [children, setPanel]); return null; };',
  ],
  [
    "useAtom in an effect",
    'import { useAtom } from "@effect/atom-react"; import { useEffect } from "react"; export const Probe = ({ atom, value }) => { const [, setValue] = useAtom(atom); useEffect(() => { setValue(value); }, [setValue, value]); return null; };',
  ],
  [
    "useAtomSet in a conditional of an effect",
    'import { useAtomSet } from "@effect/atom-react"; import { useEffect } from "react"; export const Probe = ({ atom, value }) => { const write = useAtomSet(atom); useEffect(() => { if (value) { write(value); } }, [value, write]); return null; };',
  ],
  [
    "optional state from @repo/ui",
    'import { optionalState } from "@repo/ui"; import { useEffect } from "react"; const useChoice = optionalState(); export const Probe = ({ value }) => { const [, setChoice] = useChoice(); useEffect(() => { setChoice(value); }, [value, setChoice]); return null; };',
  ],
] as const;

const allowedSetters = [
  [
    "subscription callback",
    'import { useAtom } from "@effect/atom-react"; import { useEffect } from "react"; export const Probe = ({ atom, source }) => { const [, setValue] = useAtom(atom); useEffect(() => source.subscribe((next) => { setValue(next); }), [setValue, source]); return null; };',
  ],
  [
    "event handler",
    'import { useAtom } from "@effect/atom-react"; export const Probe = ({ atom }) => { const [, setValue] = useAtom(atom); return () => { setValue(1); }; };',
  ],
  [
    "a setter that is not an atom",
    'import { useEffect } from "react"; export const Probe = ({ setValue }) => { useEffect(() => { setValue(1); }, [setValue]); return null; };',
  ],
] as const;

describe("effect-atom-setter", () => {
  it.for(settersInEffects)("rejects %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("effect-atom-setter", { code, filename: probeFile })).toBe(true);
  });

  it.for(allowedSetters)("allows %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("effect-atom-setter", { code, filename: probeFile })).toBe(false);
  });
});
