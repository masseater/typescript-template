import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { Button } from "./shared/ui";
import { ChallengeForm } from "./challenge-form";
import type { ChallengeMode } from "./challenge-form";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { useTextInput } from "./use-text-input";

interface ChallengeLoginProps {
  readonly action: ActionState;
  readonly mode: ChallengeMode;
  readonly onAuthenticated: AuthenticatedHandler;
  readonly onModeChange: (mode: ChallengeMode) => void;
  readonly onRestart: () => void;
}

function ChallengeLogin({
  action,
  mode,
  onAuthenticated,
  onModeChange,
  onRestart,
}: ChallengeLoginProps): ReactElement {
  const code = useTextInput();
  const { handleChange: setCode } = code;
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
      <ChallengeForm action={action} code={code} mode={mode} onAuthenticated={onAuthenticated} />
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
