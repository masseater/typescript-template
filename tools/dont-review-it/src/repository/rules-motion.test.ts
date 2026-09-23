import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";

const probeFile = "libs/ui/src/shared/ui/probe.tsx";

const eagerMotion = [
  ["named", 'import { motion } from "motion/react"; export const Box = motion.div;'],
  [
    "renamed",
    'import { motion as animated } from "motion/react"; export const Box = animated.div;',
  ],
  ["relayed", 'export { motion } from "motion/react";'],
] as const;

const lazyMotion = [
  ["m", 'import { m } from "motion/react"; export const Box = m.div;'],
  ["hooks", 'export { AnimatePresence, useSpring } from "motion/react";'],
  ["other-entry", 'import { motion } from "./motion.ts"; export const Box = motion;'],
] as const;

const retiredMotionPackages = [
  ["framer-motion", 'import { motion } from "framer-motion"; export const Box = motion;'],
  ["react-spring", 'export * from "@react-spring/web";'],
  ["transition-group", 'export { CSSTransition } from "react-transition-group";'],
  ["auto-animate", 'export * from "@formkit/auto-animate/react";'],
  ["animate-css", 'import "animate.css";'],
  ["hugeicons", 'export { HugeiconsIcon } from "@hugeicons/react";'],
  ["react-client", 'export * as motion from "motion/react-client";'],
] as const;

describe("lazy-motion", () => {
  it.for(eagerMotion)("rejects %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("lazy-motion", { code, filename: probeFile })).toBe(true);
  });

  it.for(lazyMotion)("allows %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("lazy-motion", { code, filename: probeFile })).toBe(false);
  });
});

describe("retired motion-package imports", () => {
  it.for(retiredMotionPackages)("rejects %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("retired-imports", { code, filename: probeFile })).toBe(true);
  });

  it("allows the motion runtime React Bits parts build on", () => {
    expect.hasAssertions();
    expect(
      reported("retired-imports", {
        code: 'export { LazyMotion, m } from "motion/react";',
        filename: probeFile,
      }),
    ).toBe(false);
  });
});
