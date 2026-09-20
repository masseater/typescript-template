import {
  Button,
  ConfirmDialog,
  Field,
  FormColumn,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  useAction,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";

import {
  createApiKey,
  revokeApiKey,
  type CreatedApiKey,
  type ListedApiKey,
} from "../api/api-keys.ts";

function ApiKeyItem({
  action,
  entry,
  onRevoked,
}: Readonly<{
  action: ReturnType<typeof useAction>["action"];
  entry: ListedApiKey;
  onRevoked: () => void;
}>): ReactElement {
  const [confirming, setConfirming] = useState(false);
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
  const { action } = useAction();
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<CreatedApiKey | undefined>(undefined);

  const reload = (): void => {
    void router.invalidate();
  };

  const issue = (): void => {
    const trimmed = name.trim();
    if (trimmed === "") {
      return;
    }
    action.run(async () => {
      const created = await createApiKey(trimmed);
      setIssued(created);
      setName("");
      reload();
    });
  };

  return (
    <Page title="AI と API">
      <FormColumn>
        <Field
          label="キーの名前"
          name="api-key-name"
          onChange={(event) => {
            setName(event.target.value);
          }}
          value={name}
        />
        <Button
          aria-label="APIキーを発行する"
          disabled={action.blocked || name.trim() === ""}
          onClick={issue}
          type="button"
          variant="primary"
        >
          APIキーを発行
        </Button>
      </FormColumn>
      {issued === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.success}>
          発行した API キー（この画面を離れると再表示できません）: {issued.key}
        </StatusMessage>
      )}
      {keys.length === 0 ? (
        <StatusMessage>API キーはまだありません。</StatusMessage>
      ) : (
        <ul>
          {keys.map((entry) => (
            <ApiKeyItem action={action} entry={entry} key={entry.id} onRevoked={reload} />
          ))}
        </ul>
      )}
    </Page>
  );
}

export { AiPage };
