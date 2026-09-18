import type { ReactElement } from "react";

import { Button, Heading, Status } from "@repo/ui";

import { usePost } from "./use-post.ts";

function LedgerMissing({ directory }: Readonly<{ directory: string }>): ReactElement {
  const create = usePost("/api/ledger");
  function handleCreate(): void {
    void create.send({});
  }
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 p-4">
      <Heading as="h1" size="page">
        この場所に bd のデータベースがありません
      </Heading>
      <p className="break-all text-foreground">{directory}</p>
      <p className="text-foreground">
        司令塔はタスクを bd に記録します。ここに作ると、この場所の作業を頼めるようになります。
      </p>
      <Button type="button" variant="primary" onClick={handleCreate} disabled={create.pending}>
        ここに作る
      </Button>
      {create.failed ? (
        <Status variant="error">作れませんでした。bd が入っているか確認してください。</Status>
      ) : undefined}
    </main>
  );
}

export { LedgerMissing };
