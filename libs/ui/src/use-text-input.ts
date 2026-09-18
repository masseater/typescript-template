import { useState } from "react";

type TextInput = {
  readonly value: string;
  readonly handleChange: (value: string) => void;
};

const useTextInput = (): TextInput => {
  const [value, setValue] = useState("");
  return { handleChange: setValue, value };
};

export { useTextInput };
export type { TextInput };
