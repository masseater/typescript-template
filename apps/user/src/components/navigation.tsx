import type { ReactElement } from "react";

function Navigation(): ReactElement {
  return (
    <nav aria-label="メイン">
      <a href="/">プロフィール</a> <a href="/security">認証設定</a> <a href="/login">ログイン</a>
    </nav>
  );
}

export { Navigation };
