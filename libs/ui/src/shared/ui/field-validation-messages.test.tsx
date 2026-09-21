import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FieldValidationMessageProvider } from "./field-validation-message-provider.tsx";
import {
  fieldValidationMessageKinds,
  useFieldValidationMessages,
} from "./field-validation-messages.ts";

import type { ReactElement } from "react";

const messages = {
  patternMismatch: "p",
  tooLong: "l",
  tooShort: "s",
  typeMismatch: "t",
  valueMissing: "v",
} as const;

const Probe = (): ReactElement => {
  const value = useFieldValidationMessages();
  return <span>{fieldValidationMessageKinds.map((kind) => value[kind]).join("")}</span>;
};

describe("field validation messages", () => {
  it("throws without a provider", () => {
    expect.hasAssertions();
    expect(() => renderToStaticMarkup(<Probe />)).toThrow("Field validation messages are missing.");
  });

  it("supplies the messages from the provider", () => {
    expect.hasAssertions();
    expect(
      renderToStaticMarkup(
        <FieldValidationMessageProvider messages={messages}>
          <Probe />
        </FieldValidationMessageProvider>,
      ),
    ).toBe("<span>vtpsl</span>");
  });
});
