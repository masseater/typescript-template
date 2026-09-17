import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ReactElement } from "react";
import { errorClassName } from "./control";

const messages: readonly (readonly [keyof ValidityState, string])[] = [
  ["valueMissing", "入力してください。"],
  ["typeMismatch", "正しい形式で入力してください。"],
  ["patternMismatch", "指定された形式で入力してください。"],
  ["tooShort", "文字数が足りません。"],
  ["tooLong", "文字数が多すぎます。"],
];

function FieldErrors(): ReactElement {
  return (
    <>
      {messages.map(([match, message]) => (
        <FieldPrimitive.Error key={match} match={match} className={errorClassName}>
          {message}
        </FieldPrimitive.Error>
      ))}
    </>
  );
}

export { FieldErrors };
