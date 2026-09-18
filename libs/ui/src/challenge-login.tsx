import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { Button } from "./shared/ui/button";
import { ChallengeForm } from "./challenge-form";
import type { ChallengeMode } from "./challenge-form";
import type { ReactElement } from "react";

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
  function toggleMode(): void {
    onModeChange(mode === "backup" ? "totp" : "backup");
  }
  return (
    <>
      <ChallengeForm key={mode} action={action} mode={mode} onAuthenticated={onAuthenticated} />
      <Button type="button" disabled={action.blocked} onClick={toggleMode}>
        {mode === "backup" ? "認証アプリのコードを使う" : "バックアップコードを使う"}
      </Button>
      <Button type="button" disabled={action.blocked} onClick={onRestart}>
        ログイン方法を選び直す
      </Button>
    </>
  );
}

export { ChallengeLogin };
