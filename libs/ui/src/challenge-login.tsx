import type { ActionState } from "./action";
import { Button } from "smarthr-ui";
import { ChallengeForm } from "./challenge-form";
import type { ChallengeMode } from "./challenge-form";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { useTextInput } from "./use-text-input";

interface ChallengeLoginProps {
  readonly action: ActionState;
  readonly mode: ChallengeMode;
  readonly onModeChange: (mode: ChallengeMode) => void;
  readonly onRestart: () => void;
}

function ChallengeLogin({
  action,
  mode,
  onModeChange,
  onRestart,
}: ChallengeLoginProps): ReactElement {
  const code = useTextInput();
  const { setValue: setCode } = code;
  const toggleMode = useCallback(() => {
    onModeChange(mode === "backup" ? "totp" : "backup");
    setCode("");
  }, [mode, onModeChange, setCode]);
  const restart = useCallback(() => {
    onRestart();
    setCode("");
  }, [onRestart, setCode]);
  return (
    <>
      <ChallengeForm action={action} code={code} mode={mode} />
      <Button type="button" disabled={action.blocked} onClick={toggleMode}>
        {mode === "backup" ? "認証アプリのコードを使う" : "バックアップコードを使う"}
      </Button>
      <Button type="button" disabled={action.blocked} onClick={restart}>
        ログイン方法を選び直す
      </Button>
    </>
  );
}

export { ChallengeLogin };
