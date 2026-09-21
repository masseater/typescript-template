---
description: "Require queryOptions, infiniteQueryOptions, and mutationOptions factories to live in an FSD api segment"
---

# require-query-options-in-api-segment--move-query-options-to-api

<!-- BEGIN GENERATED rule-header -->

Require queryOptions, infiniteQueryOptions, and mutationOptions factories to live in an FSD api segment

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `mutation-and-failure`
- Source: [`require-query-options-in-api-segment--move-query-options-to-api.ts`](../../src/lint/oxlint/rules/mutation-and-failure/require-query-options-in-api-segment--move-query-options-to-api.ts)

<!-- END GENERATED rule-header -->

## Violation

A call to `queryOptions`, `infiniteQueryOptions`, or `mutationOptions` whose file path does not contain an `api` segment. Route loaders and UI may consume the factory; they must not declare it.

## Fix

Move the factory into a module under an FSD `api` directory and import it from the route or UI that needs it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// queryOptions in a model segment is rejected
// in apps/service-member/src/pages/home/model/feed.ts
import { queryOptions } from "@tanstack/react-query";
export const homeFeedOptions = queryOptions({ queryKey: ["home"], queryFn: async () => [] });
```

```ts
// mutationOptions in ui is rejected
// in apps/service-member/src/pages/profile/ui/save.ts
import { mutationOptions } from "@tanstack/react-query";
export const saveOptions = mutationOptions({ mutationFn: async () => undefined });
```

Code this rule accepts.

```ts
// queryOptions in an api segment is allowed
// in apps/service-member/src/pages/home/api/feed.ts
import { queryOptions } from "@tanstack/react-query";
export const homeFeedOptions = queryOptions({ queryKey: ["home"], queryFn: async () => [] });
```

```ts
// useQuery outside api is allowed
// in apps/service-member/src/pages/home/ui/home-page.tsx
import { useQuery } from "@tanstack/react-query";
export const Home = () => useQuery({ queryKey: ["home"], queryFn: async () => [] });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the factory through a namespace import still reports when the called member is one of the three names
- Declaring the factory next to a route file outside `api` does not satisfy the segment check

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `queryOptionsOutsideApi` | \`queryOptions\`, \`infiniteQueryOptions\`, and \`mutationOptions\` must not be declared outside an FSD \`api\` segment. Move the factory into a module under an \`api\` directory. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
