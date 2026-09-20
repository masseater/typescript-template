import { ButtonLink, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function UpgradePage(): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        有料プラン
      </Heading>
      <StatusMessage variant={STATUS_VARIANT.pending}>
        有料プランの案内は準備中です。探す・最初のメッセージ送信が使えます。
      </StatusMessage>
      <ButtonLink to="/settings/plan" variant="primary">
        プラン設定を見る
      </ButtonLink>
    </main>
  );
}

export { UpgradePage };
