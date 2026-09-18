import type { ReactElement } from "react";
import type { SessionView } from "./protocol";
import { Status } from "./shared/ui/status";

interface RecoveryNoticeProps {
  readonly recovery: string | undefined;
  readonly role: SessionView["user"]["role"];
}

function RecoveryNotice({ recovery, role }: RecoveryNoticeProps): ReactElement | undefined {
  if (recovery === "setup") {
    return <Status>新しい認証アプリを登録してください。</Status>;
  }
  if (recovery !== "1") {
    return undefined;
  }
  return (
    <>
      <Status>バックアップコードでログインしました。</Status>
      {role === "admin" ? (
        <Status>
          復旧コードでは管理者操作はできません。ログアウト後、登録済みのパスキーまたは認証アプリで
          ログインしてください。どちらも使えない場合は、この画面から管理者の認証設定を復旧できません。
        </Status>
      ) : (
        <Status>
          認証アプリを失った場合は、パスワードを入力して古い認証アプリを解除してください。
          再ログイン後に新しい認証アプリを登録できます。使用済みのバックアップコードは再利用できません。
        </Status>
      )}
    </>
  );
}

export { RecoveryNotice };
