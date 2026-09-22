import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { FieldValidationMessageProvider } from "./field-validation-message-provider.tsx";
import {
  fieldValidationMessageKinds,
  useFieldValidationMessages,
} from "./field-validation-messages.ts";

import type { ReactElement } from "react";

describe("field validation message provider", () => {
  const it = test.extend("theSuppliedCatalogMarkup", () => {
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

  it("supplies the catalog from the provider", ({ theSuppliedCatalogMarkup }) => {
    expect(theSuppliedCatalogMarkup).toStrictEqual("<span>vtpsl</span>");
  });
});
