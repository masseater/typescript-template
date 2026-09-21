import { MEMBER_MCP_CAPABILITY, type MemberMcpCapability } from "@repo/config";
import {
  type ActionState,
  ActionStatus,
  Button,
  CheckboxField,
  ConfirmDialog,
  Field,
  FormColumn,
  Page,
  StatusMessage,
  localState,
  useAction,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { revokeApiKey, type ListedApiKey } from "#pages/settings/api/api-keys.ts";
import { saveMcpGrants, type McpGrantView } from "#pages/settings/api/mcp-grants.ts";
import { useApiKeyForm } from "#pages/settings/model/api-key-form.ts";

import type { ReactElement } from "react";

const useRevokeConfirming = localState(false);
const useGrantDraft = localState<readonly MemberMcpCapability[] | undefined>(undefined);

const grantOptions = [
  { capability: MEMBER_MCP_CAPABILITY.profileRead, label: "プロフィールの閲覧" },
  { capability: MEMBER_MCP_CAPABILITY.profileWrite, label: "プロフィールの更新" },
  { capability: MEMBER_MCP_CAPABILITY.memberSearch, label: "会員の一覧と検索" },
  { capability: MEMBER_MCP_CAPABILITY.messageSend, label: "メッセージの送信" },
] as const satisfies readonly { capability: MemberMcpCapability; label: string }[];

function selectedCapabilities(
  granted: readonly MemberMcpCapability[],
  capability: MemberMcpCapability,
  checked: boolean,
): readonly MemberMcpCapability[] {
  const without = granted.filter((held) => held !== capability);
  return checked ? [...without, capability] : without;
}

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

function AiPage({
  grants,
  keys,
}: Readonly<{ grants: McpGrantView; keys: readonly ListedApiKey[] }>): ReactElement {
  const router = useRouter();
  const reload = (): void => {
    void router.invalidate();
  };
  const form = useApiKeyForm(reload);
  const saveGrants = useAction();
  const [draft, setDraft] = useGrantDraft();
  const granted = draft ?? grants.capabilities;
  const issuedNotice =
    form.issued === undefined
      ? undefined
      : `発行した API キー（この画面を離れると再表示できません）: ${form.issued.key}`;
  const save = (): void => {
    saveGrants.run(async () => {
      const saved = await saveMcpGrants(granted);
      setDraft(saved.capabilities);
      await router.invalidate();
    });
  };

  return (
    <Page title="AI と API">
      <FormColumn>
        {grantOptions.map((option) => (
          <CheckboxField
            checked={granted.includes(option.capability)}
            key={option.capability}
            label={option.label}
            onCheckedChange={(checked) => {
              setDraft(selectedCapabilities(granted, option.capability, checked));
            }}
          />
        ))}
        <Button disabled={saveGrants.blocked} onClick={save} type="button" variant="primary">
          AI に許す操作を保存
        </Button>
        <ActionStatus action={saveGrants} />
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
