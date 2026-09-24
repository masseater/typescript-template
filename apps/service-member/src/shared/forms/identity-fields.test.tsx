import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { EmailField, NameField } from "./identity-fields.tsx";

import type { BoundTextField } from "./identity-fields.tsx";

function bound(value: string, errors: readonly unknown[] = []): BoundTextField {
  return { handleChange: () => undefined, state: { meta: { errors }, value } };
}

describe("identity fields", () => {
  it("binds the name with its label and length limit", () => {
    expect.hasAssertions();
    const html = renderedAt(
      <NameField field={bound("山田 花子")} label="お名前" maxLength={50} />,
      ["/"],
    );
    expect(html).toContain('aria-label="お名前"');
    expect(html).toContain('name="name"');
    expect(html).toContain('autoComplete="name"');
    expect(html).toContain('maxLength="50"');
    expect(html).toContain('value="山田 花子"');
  });

  it("binds the email as the account name and shows its first error", () => {
    expect.hasAssertions();
    const html = renderedAt(
      <EmailField field={bound("", [{ message: "メールアドレスを入力してください。" }])} />,
      ["/"],
    );
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain("メールアドレスを入力してください。");
  });
});
