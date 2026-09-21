import {
  type ActionState,
  ActionStatus,
  Button,
  ConfirmDialog,
  Field,
  FormColumn,
  Page,
  StatusMessage,
  localState,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { revokeApiKey, type ListedApiKey } from "#pages/settings/api/api-keys.ts";
import { useApiKeyForm } from "#pages/settings/model/api-key-form.ts";

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

function AiPage({ keys }: Readonly<{ keys: readonly ListedApiKey[] }>): ReactElement {
  const router = useRouter();
  const reload = (): void => {
    void router.invalidate();
  };
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
          onClick={form.issue}
          type="button"
          variant="primary"
        >
          APIキーを発行
        </Button>
        <ActionStatus action={form.action} notice={issuedNotice} />
      </FormColumn>
      {keys.length === 0 ? (
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
