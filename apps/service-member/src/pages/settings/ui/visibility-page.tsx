import { PROFILE_VISIBILITY } from "@repo/config";
import {
  Button,
  CheckboxField,
  FormColumn,
  Page,
  STATUS_VARIANT,
  SelectField,
  StatusMessage,
  useToast,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { useVisibilityForm } from "#pages/settings/model/visibility-form.ts";

import type { Visibility } from "#pages/settings/api/visibility.ts";
import type { ProfileVisibility } from "@repo/config";
import type { ReactElement } from "react";
const visibilityOptions = [
  {
    label: "全会員",
    value: PROFILE_VISIBILITY.allMembers,
  },
  {
    label: "自分だけ",
    value: PROFILE_VISIBILITY.self,
  },
] as const satisfies readonly Readonly<{
  label: string;
  value: ProfileVisibility;
}>[];
function VisibilityPage({
  initial,
}: Readonly<{
  initial: Visibility;
}>): ReactElement {
  const router = useRouter();
  const notify = useToast();
  function showSaved(): Promise<void> {
    return router.invalidate().then(() => notify("success", "公開範囲を保存しました。"));
  }
  const form = useVisibilityForm(initial, showSaved);
  return (
    <Page title="公開範囲">
      <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
        <FormColumn>
          <SelectField
            label="プロフィールを見られる人"
            name="visibility"
            options={visibilityOptions}
            value={form.visibility}
            onValueChange={form.handleVisibilityChange}
          />
          <p className="text-sm leading-normal text-muted-foreground">
            「自分だけ」にすると、リンクを知っている会員にもプロフィールと写真は表示されません。
          </p>
          <CheckboxField
            checked={form.searchable}
            label="会員一覧と検索に載せる"
            onCheckedChange={form.handleSearchableChange}
          />
          <Button type="submit" variant="primary" disabled={form.blocked}>
            保存
          </Button>
        </FormColumn>
      </form>
      {form.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
      )}
    </Page>
  );
}
export { VisibilityPage };
