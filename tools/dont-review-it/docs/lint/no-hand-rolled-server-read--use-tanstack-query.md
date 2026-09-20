---
description: "Disallow combining useState with fetch for server data after the TanStack Query migration"
---

# no-hand-rolled-server-read--use-tanstack-query

<!-- BEGIN GENERATED rule-header -->

Disallow combining useState with fetch for server data after the TanStack Query migration

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `mutation-and-failure`
- Source: [`no-hand-rolled-server-read--use-tanstack-query.ts`](../../src/lint/oxlint/rules/mutation-and-failure/no-hand-rolled-server-read--use-tanstack-query.ts)

<!-- END GENERATED rule-header -->

## Violation

A module that imports `useState` from `react` and also calls `fetch` (including `globalThis.fetch`) in the same file. That pairing is the hand-rolled server cache this repository replaces with TanStack Query.

## Fix

Move the read into a TanStack Query option factory under an FSD `api` segment and consume it with `useQuery` or a route loader. Drop the `useState` that held the response.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// useState and fetch in one module is rejected
import { useEffect, useState } from "react";
const Example = () => {
  const [value, setValue] = useState<string | undefined>(undefined);
  useEffect(() => { void fetch("/api/session").then((response) => response.json()).then(setValue); }, []);
  return value;
};
```

```ts
// globalThis.fetch with useState is rejected
import { useState } from "react";
const Example = () => {
  const [value, setValue] = useState("");
  void globalThis.fetch("/api/session").then(async (response) => setValue(await response.text()));
  return value;
};
```

Code this rule accepts.

```ts
// fetch without useState is allowed
async function load() { await fetch('/api/session'); }
```

```ts
// useState without fetch is allowed
import { useState } from "react";
const Example = () => { const [open, setOpen] = useState(false); return open; };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming `fetch` through a local alias still reaches the same call when the callee is a static member such as `globalThis.fetch`
- Keeping `useState` in a neighbouring module does not clear the report while this module still owns both sides

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `handRolledServerRead` | A module must not combine \`useState\` with \`fetch\` for server data. Read server data through TanStack Query option factories and \`useQuery\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
