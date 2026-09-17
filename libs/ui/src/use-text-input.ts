import type { ChangeEventHandler } from "react";
import { useState } from "react";

interface TextInput {
  readonly value: string;
  readonly setValue: (value: string) => void;
  readonly handleChange: ChangeEventHandler<HTMLInputElement>;
}

function useTextInput(): TextInput {
  const [value, setValue] = useState("");
  function handleChange(
    event: Readonly<{ target: Readonly<Pick<HTMLInputElement, "value">> }>,
  ): void {
    setValue(event.target.value);
  }
  return { handleChange, setValue, value };
}

export { useTextInput };
export type { TextInput };
