import { useCallback, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";

interface TextInput {
  readonly value: string;
  readonly setValue: (value: string) => void;
  readonly handleChange: ChangeEventHandler<HTMLInputElement>;
}

function useTextInput(): TextInput {
  const [value, setValue] = useState("");
  const handleChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    setValue(event.target.value);
  }, []);
  return useMemo(() => ({ handleChange, setValue, value }), [handleChange, value]);
}

export { useTextInput };
export type { TextInput };
