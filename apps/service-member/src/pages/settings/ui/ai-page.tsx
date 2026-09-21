import {
  type ActionState,
  ActionStatus,
  Button,
  ConfirmDialog,
  Field,
  FormColumn,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  localState,
} from "@repo/ui";

import { revokeApiKey, type ListedApiKey } from "#pages/settings/api/api-keys.ts";
import { useApiKeyForm } from "#pages/settings/model/api-key-form.ts";
import { useApiKeys } from "#pages/settings/model/api-keys.ts";

import type { ReactElement } from "react";

const useRevokeConfirming = localState(false);

function ApiKeyItem({
  action,
  entry,
  onRevoked,
}: Readonly<{
  action: ActionState;
  entry: ListedApiKey;
  onRevoked: () => void;
}>): ReactElement {
  const [confirming, setConfirming] = useRevokeConfirming();
  const label = entry.name ?? "名前のない API キー";
  const revoke = (): void => {
    setConfirming(false);
    action.run(async () => {
      await revokeApiKey(entry.id);
      onRevoked();
    });
  };
  return (
    <li>
      <span>{label}</span>
      {entry.start === null ? null : <span>{`（${entry.start}…）`}</span>}
      <Button
        aria-label={`${label}を無効にする`}
        disabled={action.blocked}
        onClick={() => {
          setConfirming(true);
        }}
        type="button"
        variant="secondary"
      >
        無効にする
      </Button>
      <ConfirmDialog
        confirmLabel="無効にする"
        description="無効にしたキーは直ちに使えなくなります。"
        onConfirm={revoke}
        onOpenChange={setConfirming}
        open={confirming}
        title={`${label}を無効にしますか？`}
        variant="danger"
      />
    </li>
  );
}

function AiPage(): ReactElement {
  const { error, keys, reload } = useApiKeys();
  const form = useApiKeyForm(reload);
  const issuedNotice =
    form.issued === undefined
      ? undefined
      : `発行した API キー（この画面を離れると再表示できません）: ${form.issued.key}`;

  return (
    <Page title="AI と API">
      <FormColumn>
        <Field
          label="キーの名前"
          name="api-key-name"
          onValueChange={form.handleNameChange}
          value={form.name}
        />
        <Button
          aria-label="APIキーを発行する"
          disabled={form.action.blocked || form.name.trim() === ""}
          onClick={form.handleIssue}
          type="button"
          variant="primary"
        >
          APIキーを発行
        </Button>
        <ActionStatus action={form.action} notice={issuedNotice} />
      </FormColumn>
      {error !== undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      ) : keys === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      ) : keys.length === 0 ? (
        <StatusMessage>API キーはまだありません。</StatusMessage>
      ) : (
        <ul>
          {keys.map((entry) => (
            <ApiKeyItem action={form.action} entry={entry} key={entry.id} onRevoked={reload} />
          ))}
        </ul>
      )}
    </Page>
  );
}

export { AiPage };
