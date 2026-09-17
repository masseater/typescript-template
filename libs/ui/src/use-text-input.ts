import { useMemo, useState } from "react";

interface TextInput {
  readonly value: string;
  readonly handleChange: (value: string) => void;
}

function useTextInput(): TextInput {
  const [value, setValue] = useState("");
  return useMemo(() => ({ handleChange: setValue, value }), [value]);
}

export { useTextInput };
export type { TextInput };
