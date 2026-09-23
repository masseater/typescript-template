import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { noHandRolledServerRead } from "./no-hand-rolled-server-read--use-tanstack-query.ts";

describe("dont-review-it/no-hand-rolled-server-read--use-tanstack-query", () => {
  testLintRule(noHandRolledServerRead, {
    valid: [
      {
        name: "fetch without useState is allowed",
        documented: true,
        code: "async function load() { await fetch('/api/session'); }",
      },
      {
        name: "useState without fetch is allowed",
        documented: true,
        code: 'import { useState } from "react";\nconst Example = () => { const [open, setOpen] = useState(false); return open; };',
      },
      {
        name: "useQuery replaces hand-rolled cache",
        code: 'import { useQuery } from "@tanstack/react-query";\nconst Example = () => useQuery({ queryKey: ["session"], queryFn: () => fetch("/api/session") });',
      },
    ],
    invalid: [
      {
        name: "useState and fetch in one module is rejected",
        documented: true,
        code: 'import { useEffect, useState } from "react";\nconst Example = () => {\n  const [value, setValue] = useState<string | undefined>(undefined);\n  useEffect(() => { void fetch("/api/session").then((response) => response.json()).then(setValue); }, []);\n  return value;\n};',
        errors: [{ messageId: "handRolledServerRead" }],
      },
      {
        name: "globalThis.fetch with useState is rejected",
        documented: true,
        code: 'import { useState } from "react";\nconst Example = () => {\n  const [value, setValue] = useState("");\n  void globalThis.fetch("/api/session").then(async (response) => setValue(await response.text()));\n  return value;\n};',
        errors: [{ messageId: "handRolledServerRead" }],
      },
    ],
  });
});
