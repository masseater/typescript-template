import { Link } from "@tanstack/react-router";
import { Page } from "@template/ui";
import type { ReactElement } from "react";

function ProfileMissing(): ReactElement {
  return (
    <Page title="利用者が見つかりません">
      <p className="text-base leading-normal">
        この利用者のプロフィールは表示できません。アドレスが正しいかを確かめてください。
      </p>
      <Link to="/users">ユーザーを探す</Link>
    </Page>
  );
}

export { ProfileMissing };
