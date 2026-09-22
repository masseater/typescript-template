import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import {
  fieldValidationMessageKinds,
  useFieldValidationMessages,
} from "./field-validation-messages.ts";

describe("field validation messages", () => {
  const it = test.extend("theMissingCatalog", () => {
    const ReadJapaneseFieldValidationCatalog = (): ReactElement => {
      const japaneseFieldValidationMessages = useFieldValidationMessages();
      return createElement(
        "span",
        null,
        fieldValidationMessageKinds
          .map((constraintKind) => japaneseFieldValidationMessages[constraintKind])
          .join(""),
      );
    };
    try {
      return renderToStaticMarkup(createElement(ReadJapaneseFieldValidationCatalog));
    } catch (thrown) {
      return thrown;
    }
  });

  it("throws without a provider", ({ theMissingCatalog }) => {
    expect(theMissingCatalog).toStrictEqual(new Error("Field validation messages are missing."));
  });
});
