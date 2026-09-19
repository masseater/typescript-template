import { useState } from "react";

type TextInput = {
  readonly value: string;
  readonly handleChange: (value: string) => void;
};

const useTextInput = (): TextInput => {
  const [entered, setEntered] = useState("");
  return { handleChange: setEntered, value: entered };
};

export { useTextInput };
export type { TextInput };
