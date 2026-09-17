import type { ReactElement } from "react";

function Navigation(): ReactElement {
  return (
    <nav aria-label="メイン">
      <a href="/">ユーザー管理</a> <a href="/security">認証設定</a> <a href="/login">ログイン</a>
    </nav>
  );
}

export { Navigation };
