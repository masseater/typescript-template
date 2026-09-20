import { PROFILE_VISIBILITY, profileVisibilities } from "@repo/config";
import {
  Button,
  CheckboxField,
  FormColumn,
  Page,
  STATUS_VARIANT,
  SelectField,
  StatusMessage,
  useAction,
  useToast,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";

import { saveVisibility } from "#pages/settings/api/visibility.ts";

import type { Visibility } from "#pages/settings/api/visibility.ts";
import type { ProfileVisibility } from "@repo/config";
import type { ReactElement } from "react";

const isVisibility = Schema.is(Schema.Literals(profileVisibilities));

const visibilityOptions = [
  { label: "全会員", value: PROFILE_VISIBILITY.allMembers },
  { label: "自分だけ", value: PROFILE_VISIBILITY.self },
] as const satisfies readonly Readonly<{ label: string; value: ProfileVisibility }>[];

function VisibilityPage({ initial }: Readonly<{ initial: Visibility }>): ReactElement {
  const [visibility, setVisibility] = useState<ProfileVisibility>(initial.visibility);
  const [searchable, setSearchable] = useState(initial.searchable);
  const action = useAction();
  const router = useRouter();
  const notify = useToast();
  function handleVisibilityChange(value: string): void {
    if (isVisibility(value)) {
      setVisibility(value);
    }
  }
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await saveVisibility({ searchable, visibility });
      await router.invalidate();
      notify("success", "公開範囲を保存しました。");
    });
  }
  return (
    <Page title="公開範囲">
      <form onSubmit={handleSubmit} aria-busy={action.pending}>
        <FormColumn>
          <SelectField
            label="プロフィールを見られる人"
            name="visibility"
            options={visibilityOptions}
            value={visibility}
            onValueChange={handleVisibilityChange}
          />
          <p className="text-sm leading-normal text-muted-foreground">
            「自分だけ」にすると、リンクを知っている会員にもプロフィールと写真は表示されません。
          </p>
          <CheckboxField
            checked={searchable}
            label="会員一覧と検索に載せる"
            onCheckedChange={setSearchable}
          />
          <Button type="submit" variant="primary" disabled={action.blocked}>
            保存
          </Button>
        </FormColumn>
      </form>
      {action.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      )}
    </Page>
  );
}

export { VisibilityPage };
