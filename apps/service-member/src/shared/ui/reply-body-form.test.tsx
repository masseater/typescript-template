import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { ReplyBodyForm } from "./reply-body-form.tsx";

import type { ReplyBodyFormState } from "./reply-body-form.tsx";

function rendered(state: Partial<ReplyBodyFormState>): string {
  return renderedAt(
    <ReplyBodyForm
      form={{
        blocked: false,
        body: "",
        error: undefined,
        handleBodyChange: () => undefined,
        handleSubmit: () => undefined,
        pending: false,
        ...state,
      }}
      label="返信"
      maxLength={2000}
      submitLabel="投稿する"
    />,
    ["/"],
  );
}

describe("reply body form", () => {
  it("labels the body field and the submit button", () => {
    expect.hasAssertions();
    const html = rendered({ body: "こんにちは" });
    expect(html).toContain('aria-label="返信"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain("こんにちは</textarea>");
    expect(html).toContain("投稿する");
    expect(html).toContain('aria-busy="false"');
  });

  it("marks the form busy and shows the failure", () => {
    expect.hasAssertions();
    const html = rendered({ blocked: true, error: "送れませんでした。", pending: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("送れませんでした。");
  });
});
