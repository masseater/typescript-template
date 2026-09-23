import { ButtonLink, Page, RequestContent, StatusMessage } from "@repo/ui";

import { useAgreementVersions } from "#pages/terms/model/agreement-versions.ts";
import { AgreementDraftForm } from "./agreement-draft-form.tsx";
import { AgreementVersionTable } from "./agreement-version-table.tsx";

import type { VersionList } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function AgreementVersions({
  versions,
}: Readonly<{ versions: VersionList["versions"] }>): ReactElement {
  if (versions.length === 0) {
    return <StatusMessage>まだ規約はありません。</StatusMessage>;
  }
  return <AgreementVersionTable versions={versions} />;
}

function TermsPage({ drafting }: Readonly<{ drafting: boolean }>): ReactElement {
  const { reload, state } = useAgreementVersions();
  return (
    <Page layout="full" title="規約">
      <div>
        {drafting ? (
          <ButtonLink search={{}} to="/terms">
            草稿の作成をやめる
          </ButtonLink>
        ) : (
          <ButtonLink search={{ draft: true }} to="/terms" variant="primary">
            新しい草稿
          </ButtonLink>
        )}
      </div>
      {drafting && <AgreementDraftForm />}
      <RequestContent failureTitle="一覧を取得できませんでした。" fetched={state} onRetry={reload}>
        {(list) => <AgreementVersions versions={list.versions} />}
      </RequestContent>
    </Page>
  );
}

export { TermsPage };
