import { useState } from "react";

interface TextInput {
  readonly value: string;
  readonly handleChange: (value: string) => void;
}

function useTextInput(): TextInput {
  const [value, setValue] = useState("");
  return { handleChange: setValue, value };
}

export { useTextInput };
export type { TextInput };
