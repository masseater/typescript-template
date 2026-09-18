import { ButtonLink, TextLink } from "@template/ui";
import type { ReactElement } from "react";

function Hero(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="text-2xl leading-tight font-bold text-foreground">
        プロフィールでつながる、あたらしい居場所
      </h1>
      <p className="text-lg leading-relaxed text-muted-foreground">
        自己紹介を書いて、気になる人を探せます。アカウントはパスキーと 2 段階認証で守れます。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <ButtonLink to="/signup" size="large" variant="primary">
          新規登録
        </ButtonLink>
        <TextLink to="/login">ログイン</TextLink>
      </div>
    </section>
  );
}

export { Hero };
