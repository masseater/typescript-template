import { Button, ButtonLink, STATUS_VARIANT, StatusMessage, formatWarekiDate } from "@repo/ui";

import { agreementKindLabels, stateLabel } from "#pages/terms/model/agreement-labels.ts";
import { useAgreementVersion } from "#pages/terms/model/agreement-versions.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { DraftEditor } from "./draft-editor.tsx";

import type { Loaded, VersionDetail } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function PublishedBody({ version }: Readonly<{ version: VersionDetail }>): ReactElement {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        公開日:{" "}
        {version.publishedAt === null ? "—" : formatWarekiDate(new Date(version.publishedAt))}
      </p>
      {version.summary !== null && version.summary !== "" && (
        <p className="text-sm">{version.summary}</p>
      )}
      <pre className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">
        {version.body}
      </pre>
    </>
  );
}

function VersionContent({
  onReload,
  state,
}: Readonly<{ onReload: () => void; state: Loaded<VersionDetail> }>): ReactElement {
  if (state.status === "loading") {
    return <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>;
  }
  if (state.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-2">
        <StatusMessage variant={STATUS_VARIANT.failure}>
          版を取得できませんでした。{state.message}
        </StatusMessage>
        <Button type="button" onClick={onReload}>
          再試行
        </Button>
      </div>
    );
  }
  const version = state.value;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {agreementKindLabels[version.kind]} / {stateLabel(version.publishedAt)}
      </p>
      {version.publishedAt === null ? (
        <DraftEditor key={version.id} onSaved={onReload} version={version} />
      ) : (
        <PublishedBody version={version} />
      )}
    </>
  );
}

function TermsVersionPage({ version }: Readonly<{ version: string }>): ReactElement {
  const { reload, state } = useAgreementVersion(version);
  return (
    <OpsPage title={version}>
      <div>
        <ButtonLink search={{}} to="/terms">
          一覧に戻る
        </ButtonLink>
      </div>
      <VersionContent onReload={reload} state={state} />
    </OpsPage>
  );
}

export { TermsVersionPage };
