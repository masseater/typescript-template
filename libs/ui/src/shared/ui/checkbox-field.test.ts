import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { CheckboxField } from "./checkbox-field";

const label = "バックアップコードを保管しました";

const changes: boolean[] = [];

function record(checked: boolean): void {
  changes.push(checked);
}

function serverMarkup(): string {
  return renderToStaticMarkup(
    createElement(CheckboxField, { checked: false, label, onCheckedChange: record }),
  );
}

describe("server rendered checkbox", () => {
  it("names the checkbox before hydration", () => {
    expect.hasAssertions();
    expect(serverMarkup()).toContain(`role="checkbox"`);
    expect(serverMarkup()).toMatch(
      new RegExp(`<span[^>]*role="checkbox"[^>]*aria-label="${label}"`, "u"),
    );
  });

  it("keeps the label element pointing at a control", () => {
    expect.hasAssertions();
    expect(serverMarkup()).toMatch(/<label[^>]*for="[^"]+"/u);
  });
});
