import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { requireQueryOptionsInApiSegment } from "./require-query-options-in-api-segment--move-query-options-to-api.ts";

describe("dont-review-it/require-query-options-in-api-segment--move-query-options-to-api", () => {
  testLintRule(requireQueryOptionsInApiSegment, {
    valid: [
      {
        name: "queryOptions in an api segment is allowed",
        documented: true,
        filename: "apps/service-member/src/pages/home/api/feed.ts",
        code: 'import { queryOptions } from "@tanstack/react-query";\nexport const homeFeedOptions = queryOptions({ queryKey: ["home"], queryFn: async () => [] });',
      },
      {
        name: "useQuery outside api is allowed",
        documented: true,
        filename: "apps/service-member/src/pages/home/ui/home-page.tsx",
        code: 'import { useQuery } from "@tanstack/react-query";\nexport const Home = () => useQuery({ queryKey: ["home"], queryFn: async () => [] });',
      },
    ],
    invalid: [
      {
        name: "queryOptions in a model segment is rejected",
        documented: true,
        filename: "apps/service-member/src/pages/home/model/feed.ts",
        code: 'import { queryOptions } from "@tanstack/react-query";\nexport const homeFeedOptions = queryOptions({ queryKey: ["home"], queryFn: async () => [] });',
        errors: [{ messageId: "queryOptionsOutsideApi" }],
      },
      {
        name: "mutationOptions in ui is rejected",
        documented: true,
        filename: "apps/service-member/src/pages/profile/ui/save.ts",
        code: 'import { mutationOptions } from "@tanstack/react-query";\nexport const saveOptions = mutationOptions({ mutationFn: async () => undefined });',
        errors: [{ messageId: "queryOptionsOutsideApi" }],
      },
    ],
  });
});
