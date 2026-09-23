import { useOptionalString } from "@repo/ui";
import { Option } from "effect";

const useNotice = (): {
  readonly clearNotice: () => void;
  readonly notice: string | undefined;
  readonly showNotice: (noticeCopy: string) => void;
} => {
  const [notice, setNotice] = useOptionalString();
  const showNotice = (noticeCopy: string): void => {
    setNotice(Option.some(noticeCopy));
  };
  const clearNotice = (): void => {
    setNotice(Option.none());
  };
  return { clearNotice, notice: Option.getOrUndefined(notice), showNotice };
};

export { useNotice };
