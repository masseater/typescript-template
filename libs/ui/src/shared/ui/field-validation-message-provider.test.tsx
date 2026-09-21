import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { FieldValidationMessageProvider } from "./field-validation-message-provider.tsx";
import {
  fieldValidationMessageKinds,
  useFieldValidationMessages,
} from "./field-validation-messages.ts";

import type { ReactElement } from "react";

describe("field validation messages", () => {
  const it = test
    .extend("theMissingCatalog", () => {
      const ReadJapaneseFieldValidationCatalog = (): ReactElement => {
        const japaneseFieldValidationMessages = useFieldValidationMessages();
        return (
          <span>
            {fieldValidationMessageKinds
              .map((constraintKind) => japaneseFieldValidationMessages[constraintKind])
              .join("")}
          </span>
        );
      };
      try {
        return renderToStaticMarkup(<ReadJapaneseFieldValidationCatalog />);
      } catch (thrown) {
        return thrown;
      }
    })
    .extend("theSuppliedCatalogMarkup", () => {
      const japaneseFieldValidationMessages = {
        patternMismatch: "p",
        tooLong: "l",
        tooShort: "s",
        typeMismatch: "t",
        valueMissing: "v",
      } as const;
      const ReadJapaneseFieldValidationCatalog = (): ReactElement => {
        const suppliedFieldValidationMessages = useFieldValidationMessages();
        return (
          <span>
            {fieldValidationMessageKinds
              .map((constraintKind) => suppliedFieldValidationMessages[constraintKind])
              .join("")}
          </span>
        );
      };
      return renderToStaticMarkup(
        <FieldValidationMessageProvider messages={japaneseFieldValidationMessages}>
          <ReadJapaneseFieldValidationCatalog />
        </FieldValidationMessageProvider>,
      );
    });

  it("throws without a provider", ({ theMissingCatalog }) => {
    expect(theMissingCatalog).toStrictEqual(new Error("Field validation messages are missing."));
  });

  it("supplies the catalog from the provider", ({ theSuppliedCatalogMarkup }) => {
    expect(theSuppliedCatalogMarkup).toStrictEqual("<span>vtpsl</span>");
  });
});
