import { ButtonLink, Page, RequestContent, formatWarekiDate } from "@repo/ui";
import { DateTime } from "effect";

import { agreementKindLabels, stateLabel } from "#pages/terms/model/agreement-labels.ts";
import { useAgreementVersion } from "#pages/terms/model/agreement-versions.ts";
import { DraftEditor } from "./draft-editor.tsx";

import type { VersionDetail } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function PublishedBody({ version }: Readonly<{ version: VersionDetail }>): ReactElement {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        公開日:{" "}
        {version.publishedAt === null
          ? "—"
          : formatWarekiDate(DateTime.toDate(DateTime.makeUnsafe(version.publishedAt)))}
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
  version,
}: Readonly<{ onReload: () => void; version: VersionDetail }>): ReactElement {
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
    <Page title={version}>
      <div>
        <ButtonLink search={{}} to="/terms">
          一覧に戻る
        </ButtonLink>
      </div>
      <RequestContent failureTitle="版を取得できませんでした。" fetched={state} onRetry={reload}>
        {(detail) => <VersionContent onReload={reload} version={detail} />}
      </RequestContent>
    </Page>
  );
}

export { TermsVersionPage };
