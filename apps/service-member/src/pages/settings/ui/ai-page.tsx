import { errorMessage } from "@repo/auth-ui";
import { MEMBER_MCP_SCOPE } from "@repo/config";
import {
  type ActionState,
  ActionStatus,
  Button,
  CheckboxField,
  ConfirmDialog,
  Field,
  FormColumn,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  localState,
  useAction,
} from "@repo/ui";
import { useEffect, useState, type ReactElement } from "react";

import { loadApiKeys, revokeApiKey, type ListedApiKey } from "#pages/settings/api/api-keys.ts";
import { useApiKeyForm } from "#pages/settings/model/api-key-form.ts";
import { scopeLabel } from "#shared/contracts/index.ts";

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

type ListedKeys =
  | Readonly<{ keys: readonly ListedApiKey[]; status: "ready" }>
  | Readonly<{ message: string; status: "failed" }>
  | Readonly<{ status: "pending" }>;

function AiPage(): ReactElement {
  const [listed, setListed] = useState<ListedKeys>({ status: "pending" });
  const reload = (): void => {
    setListed({ status: "pending" });
    void loadApiKeys()
      .then((keys) => {
        setListed({ keys, status: "ready" });
      })
      .catch((failure: unknown) => {
        setListed({ message: errorMessage(failure), status: "failed" });
      });
  };
  useEffect(() => {
    reload();
  }, []);
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
        <CheckboxField
          checked={form.profileUpdate}
          label={scopeLabel(MEMBER_MCP_SCOPE.profileUpdate)}
          onCheckedChange={form.handleProfileUpdateChange}
        />
        <CheckboxField
          checked={form.messageSend}
          label={scopeLabel(MEMBER_MCP_SCOPE.messageSend)}
          onCheckedChange={form.handleMessageSendChange}
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
      {listed.status === "pending" ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      ) : listed.status === "failed" ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>{listed.message}</StatusMessage>
      ) : listed.keys.length === 0 ? (
        <StatusMessage>API キーはまだありません。</StatusMessage>
      ) : (
        <ul>
          {listed.keys.map((entry) => (
            <ApiKeyItem action={form.action} entry={entry} key={entry.id} onRevoked={reload} />
          ))}
        </ul>
      )}
    </Page>
  );
}

export { AiPage };
