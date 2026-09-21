import {
  Button,
  ButtonLink,
  STATUS_VARIANT,
  StatusMessage,
  type RequestResult,
  resultError,
} from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useAgreementVersions } from "#pages/terms/model/agreement-versions.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { AgreementDraftForm } from "./agreement-draft-form.tsx";
import { AgreementVersionTable } from "./agreement-version-table.tsx";

import type { VersionList } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function VersionResults({
  onReload,
  state,
}: Readonly<{ onReload: () => void; state: RequestResult<VersionList> }>): ReactElement {
  const failure = resultError(state);
  if (failure !== undefined) {
    return (
      <div className="flex flex-col items-start gap-2">
        <StatusMessage variant={STATUS_VARIANT.failure}>
          一覧を取得できませんでした。{failure}
        </StatusMessage>
        <Button type="button" onClick={onReload}>
          再試行
        </Button>
      </div>
    );
  }
  if (!AsyncResult.isSuccess(state) || state.waiting) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>;
  }
  if (state.value.versions.length === 0) {
    return <StatusMessage>まだ規約はありません。</StatusMessage>;
  }
  return <AgreementVersionTable versions={state.value.versions} />;
}

function TermsPage({ drafting }: Readonly<{ drafting: boolean }>): ReactElement {
  const { reload, state } = useAgreementVersions();
  return (
    <OpsPage title="規約">
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
      <VersionResults onReload={reload} state={state} />
    </OpsPage>
  );
}

export { TermsPage };
