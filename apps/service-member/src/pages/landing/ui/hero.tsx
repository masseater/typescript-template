import { ButtonLink, TextLink } from "@repo/ui";

import { serviceName } from "#shared/config/index.ts";
import { ProfilePreview } from "./profile-preview.tsx";

import type { ReactElement } from "react";

function Hero(): ReactElement {
  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto grid w-full max-w-wide items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-12 md:py-20">
        <div className="flex flex-col gap-6">
          <p className="text-2xl leading-tight font-bold text-foreground">{serviceName}</p>
          <h1 className="text-xl leading-tight font-bold text-foreground md:text-2xl">
            自分のページを持つところから始まる
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            自己紹介を書いて、気になる人を探せます。アカウントはパスキーと 2 段階認証で守れます。
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink to="/signup" size="large" variant="primary">
              新規登録
            </ButtonLink>
            <TextLink to="/login">ログイン</TextLink>
          </div>
        </div>
        <ProfilePreview />
      </div>
    </section>
  );
}

export { Hero };
