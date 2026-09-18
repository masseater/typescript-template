import { localState } from "./local-state";

interface TextInput {
  readonly value: string;
  readonly handleChange: (value: string) => void;
}

const useText = localState("");

function useTextInput(): TextInput {
  const [value, setValue] = useText();
  return { handleChange: setValue, value };
}

export { useTextInput };
export type { TextInput };
