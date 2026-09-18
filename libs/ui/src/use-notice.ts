import { Option } from "effect";
import { localState } from "./local-state";

interface NoticeState {
  readonly clearNotice: () => void;
  readonly notice: string | undefined;
  readonly showNotice: (message: string) => void;
}

const useNoticeValue = localState(Option.none<string>());

function useNotice(): NoticeState {
  const [notice, setNotice] = useNoticeValue();
  function showNotice(message: string): void {
    setNotice(Option.some(message));
  }
  function clearNotice(): void {
    setNotice(Option.none());
  }
  return { clearNotice, notice: Option.getOrUndefined(notice), showNotice };
}

export { useNotice };
