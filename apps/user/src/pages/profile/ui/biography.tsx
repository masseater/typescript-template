import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

function Biography({ own, text }: Readonly<{ own: boolean; text: string }>): ReactElement {
  if (text !== "") {
    return <p className="text-base leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  return own ? (
    <p className="text-base leading-normal text-muted-foreground">
      自己紹介はまだありません。<Link to="/settings/profile">プロフィールを編集</Link>
      して書いてみましょう。
    </p>
  ) : (
    <p className="text-base leading-normal text-muted-foreground">自己紹介はまだありません</p>
  );
}

export { Biography };
