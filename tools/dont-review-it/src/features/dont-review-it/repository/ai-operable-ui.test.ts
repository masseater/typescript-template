import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  aiOperableUiViolations,
  browserConfirmViolations,
  captchaImportViolations,
  duplicateAccessibleNamesInMarkup,
  hoverOnlyActionViolations,
  resultAnnouncedInMarkup,
  shippedUiRuleViolations,
  unnamedButtonsInMarkup,
  unnamedControlViolations,
  urlHoldsScreenState,
} from "./ai-operable-ui.ts";
import { repositoryRoot } from "./repository-root.ts";

const shippedModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../../../{apps,libs}/**/*.{ts,tsx}",
);

const fixture = (name: string, source: string): void => {
  it(`detects ${name}`, () => {
    expect.hasAssertions();
    expect(aiOperableUiViolations(source).length).toBeGreaterThan(0);
  });
};

describe("AI-operable UI source rules", () => {
  fixture(
    "a captcha import",
    'import Turnstile from "@marsidev/react-turnstile";\nexport const Wall = Turnstile;\n',
  );

  fixture(
    "window.confirm",
    'export const remove = () => { if (!window.confirm("消しますか？")) return; };\n',
  );

  fixture(
    "globalThis.confirm",
    'export const remove = () => { if (!globalThis.confirm("消しますか？")) return; };\n',
  );

  fixture("window.alert", 'export const warn = () => { window.alert("完了"); };\n');

  fixture(
    "a hover-only row action",
    'export const Row = () => <button type="button" className="opacity-0 group-hover:opacity-100">削除</button>;\n',
  );

  fixture(
    "a hover-only action with template className",
    'export const Row = () => <button type="button" className={`invisible group-hover:visible`}>削除</button>;\n',
  );

  fixture(
    "a hover-only action with single-quoted className",
    "export const Row = () => <button type=\"button\" className='opacity-0 group-hover:opacity-100'>削除</button>;\n",
  );

  fixture(
    "an unnamed icon button",
    'export const IconOnly = () => <button type="button"><svg aria-hidden="true" /></button>;\n',
  );

  fixture(
    "a self-closing unnamed button",
    'export const Empty = () => <button type="button" />;\n',
  );

  it("ignores buttons whose body is not icon-only and has no static name", () => {
    expect.hasAssertions();
    expect(
      unnamedControlViolations(
        'export const Dynamic = () => <button type="button">{label}</button>;\n',
      ),
    ).toStrictEqual([]);
  });

  it("ignores incomplete button tags", () => {
    expect.hasAssertions();
    expect(
      unnamedControlViolations('export const Broken = () => <button type="button"'),
    ).toStrictEqual([]);
  });

  it("reports each captcha package import", () => {
    expect.hasAssertions();
    expect(
      captchaImportViolations('import X from "@hcaptcha/react-hcaptcha";\n'),
    ).not.toStrictEqual([]);
  });

  it("accepts a named menu trigger", () => {
    expect.hasAssertions();
    expect(
      aiOperableUiViolations(
        'export const Menu = () => <button type="button" aria-label="操作">...</button>;\n',
      ),
    ).toStrictEqual([]);
  });

  it("accepts ConfirmDialog usage", () => {
    expect.hasAssertions();
    expect(
      browserConfirmViolations(
        'export const ask = () => <ConfirmDialog title="削除しますか？" confirmLabel="削除する" />;\n',
      ),
    ).toStrictEqual([]);
  });

  it("accepts StatusMessage text for results", () => {
    expect.hasAssertions();
    expect(
      unnamedControlViolations(
        'export const Done = () => <StatusMessage variant="success">保存しました</StatusMessage>;\n',
      ),
    ).toStrictEqual([]);
  });

  it("accepts visible controls without hover reveal", () => {
    expect.hasAssertions();
    expect(
      hoverOnlyActionViolations(
        'export const Row = () => <button type="button" className="opacity-100">削除</button>;\n',
      ),
    ).toStrictEqual([]);
    expect(
      hoverOnlyActionViolations(
        'export const Row = () => <button type="button" className="">削除</button>;\n',
      ),
    ).toStrictEqual([]);
  });

  it("requires dialog and tab state in the URL", () => {
    expect.hasAssertions();
    expect(urlHoldsScreenState("https://example.test/users", ["dialog", "tab"])).toBe(false);
    expect(
      urlHoldsScreenState("https://example.test/users?tab=active&dialog=user-1", ["dialog", "tab"]),
    ).toBe(true);
    expect(
      urlHoldsScreenState("https://example.test/users#dialog=user-1&tab=active", ["dialog", "tab"]),
    ).toBe(true);
    expect(urlHoldsScreenState("https://example.test/users#dialog", ["dialog"])).toBe(true);
  });

  it("reports duplicate accessible names in markup", () => {
    expect.hasAssertions();
    expect(
      duplicateAccessibleNamesInMarkup(
        '<main><button type="button">保存</button><button type="button">保存</button><button type="button">取消</button><button type="button">取消</button><button type="button"><svg></svg></button></main>',
      ),
    ).toStrictEqual([
      { count: 2, name: "保存", role: "button" },
      { count: 2, name: "取消", role: "button" },
    ]);
    expect(
      duplicateAccessibleNamesInMarkup('<main><a href="/a">詳細</a><a href="/b">詳細</a></main>'),
    ).toStrictEqual([{ count: 2, name: "詳細", role: "link" }]);
    expect(
      duplicateAccessibleNamesInMarkup(
        '<main><button type="button">保存</button><button type="button" aria-label="下書きを保存">下書き</button></main>',
      ),
    ).toStrictEqual([]);
  });

  it("reports unnamed buttons in markup", () => {
    expect.hasAssertions();
    expect(
      unnamedButtonsInMarkup(
        '<main><button type="button"><svg width="16" height="16"></svg></button></main>',
      ),
    ).toStrictEqual(["button#0"]);
  });

  it("requires results to be announced as text in markup", () => {
    expect.hasAssertions();
    expect(
      resultAnnouncedInMarkup(
        '<main><span class="bg-success" aria-hidden="true"></span></main>',
        "保存しました",
      ),
    ).toBe(false);
    expect(
      resultAnnouncedInMarkup(
        '<main><p role="status" aria-live="polite">保存しました</p></main>',
        "保存しました",
      ),
    ).toBe(true);
    expect(
      resultAnnouncedInMarkup('<main><p role="alert">失敗しました</p></main>', "失敗しました"),
    ).toBe(true);
    expect(
      resultAnnouncedInMarkup(
        '<main><p role="status">処理中</p><span>保存しました</span></main>',
        "保存しました",
      ),
    ).toBe(true);
  });

  it("keeps shipped UI free of captcha, browser confirm, and hover-only actions", () => {
    expect.hasAssertions();
    const violations = Object.keys(shippedModules)
      .map((file) => file.replace(/^(?:\.\.\/)+/u, ""))
      .filter(
        (file) =>
          !file.includes(".stories.") &&
          !file.includes(".test.") &&
          !file.endsWith("routeTree.gen.ts"),
      )
      .toSorted()
      .flatMap((file) => {
        const absolute = path.join(repositoryRoot, file);
        return existsSync(absolute)
          ? shippedUiRuleViolations(readFileSync(absolute, "utf8")).map(
              (violation) => `${file}: ${violation}`,
            )
          : [];
      });
    expect(violations).toStrictEqual([]);
  });
});
