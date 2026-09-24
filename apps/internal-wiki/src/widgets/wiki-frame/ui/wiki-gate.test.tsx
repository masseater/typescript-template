import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { WikiGate } from "./wiki-gate.tsx";

const rendered = (state: Readonly<{ allowed: boolean; error?: string; loading: boolean }>) =>
  renderToStaticMarkup(
    <WikiGate allowed={state.allowed} error={state.error} loading={state.loading}>
      <main>本文</main>
    </WikiGate>,
  );

describe("wiki gate", () => {
  it("shows the loading message while the session is loading", () => {
    expect(rendered({ allowed: false, loading: true })).toContain("読み込み中です。");
  });

  it("shows the session error", () => {
    expect(rendered({ allowed: false, error: "読み込めません", loading: false })).toContain(
      "読み込めません",
    );
  });

  it("renders the page for an allowed session", () => {
    expect(rendered({ allowed: true, loading: false })).toBe("<main>本文</main>");
  });

  it("renders nothing for a session that is being redirected", () => {
    expect(rendered({ allowed: false, loading: false })).toBe("");
  });
});
