import { readFileSync } from "node:fs";
import { plugin, project } from "@shadcn/lint";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { expect, test } from "vite-plus/test";
import config from "../../vite.config.ts";
import { smarthrTokens, tokenViolations, untouchedTokens } from "./design-system.ts";

RuleTester.describe = (_text, run) => run();
RuleTester.it = (_text, run) => run();
const tester = new RuleTester({});
const options = [{ allow: ["layout", "spacing"], componentImports: ["^@template/ui/ui(/|$)"] }];
const probe = "apps/user/src/routes/probe.tsx";
const restyled = [
  ["no-restyle", "bg-destructive"],
  ["no-raw-colors", "text-red-500"],
  ["no-arbitrary-values", "text-[13px]"],
  ["no-unknown-classes", "shadow-xs"],
] as const;

test("the stylesheet the linter reads carries the smarthr-ui token values", () => {
  const stylesheet = project.themeFileFor(probe);
  expect(stylesheet).toMatch(/libs\/ui\/src\/styles\.css$/);
  expect(tokenViolations(readFileSync(stylesheet ?? "", "utf8"))).toEqual([]);
});

test.for(Object.keys(smarthrTokens))("reports %s when it drifts from smarthr-ui", (token) => {
  expect(tokenViolations(`:root { ${token}: rebeccapurple; }`)).toContainEqual(
    expect.stringContaining(token),
  );
});

test.for(untouchedTokens)("reports %s when it is redefined", (token) => {
  expect(tokenViolations(`@theme { ${token}: 8px; }`)).toContainEqual(
    expect.stringContaining(token),
  );
});

test("every design-system rule is enabled", () => {
  expect(config.lint?.jsPlugins).toContain("@shadcn/lint");
  expect(config.lint?.rules).toMatchObject(
    Object.fromEntries(
      restyled.map(([rule]) => [
        `shadcn/${rule}`,
        rule === "no-restyle" ? ["error", { allow: ["layout", "spacing"] }] : "error",
      ]),
    ),
  );
});

test.for(restyled)("%s reports a screen that restyles a part", ([rule, className]) => {
  const target = plugin.rules[rule];
  if (!target) throw new Error(`Unknown rule ${rule}`);
  expect(() =>
    tester.run(rule, target, {
      valid: [
        {
          filename: probe,
          code: `import { Button } from "@template/ui/ui";\nexport const Probe = () => <Button className="${className}" />;\n`,
          options,
        },
      ],
      invalid: [],
    }),
  ).toThrow(/Should have no errors/);
});
