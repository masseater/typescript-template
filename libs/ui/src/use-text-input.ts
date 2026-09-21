import { localState } from "./local-state";

type TextInput = {
  readonly value: string;
  readonly handleChange: (value: string) => void;
};

const useText = localState("");

const useTextInput = (): TextInput => {
  const [entered, setEntered] = useText();
  return { handleChange: setEntered, value: entered };
};

export { useTextInput };
export type { TextInput };
