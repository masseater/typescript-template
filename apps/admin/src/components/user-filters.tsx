import { Button, Field, SelectField } from "@template/ui/ui";
import type { ReactElement } from "react";
import type { UsersSearch } from "#users-search.ts";
import { useUserFilterForm } from "#user-filter-form.ts";

const KEYWORD_LIMIT = 100;

const roleOptions = [
  { label: "すべて", value: "" },
  { label: "管理者", value: "admin" },
  { label: "一般", value: "user" },
] as const;

const verifiedOptions = [
  { label: "すべて", value: "" },
  { label: "確認済み", value: "true" },
  { label: "未確認", value: "false" },
] as const;

function UserFilters({ search }: Readonly<{ search: UsersSearch }>): ReactElement {
  const form = useUserFilterForm(search);
  return (
    <form
      aria-label="ユーザーの絞り込み"
      onSubmit={form.handleSubmit}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="w-full sm:w-72">
        <Field
          label="名前・メールアドレス"
          name="keyword"
          type="search"
          maxLength={KEYWORD_LIMIT}
          value={form.keyword}
          onChange={form.handleKeywordChange}
        />
      </div>
      <div className="w-32">
        <SelectField
          label="権限"
          name="role"
          options={roleOptions}
          value={form.role}
          onValueChange={form.handleRoleChange}
        />
      </div>
      <div className="w-32">
        <SelectField
          label="メール確認"
          name="verified"
          options={verifiedOptions}
          value={form.verified}
          onValueChange={form.handleVerifiedChange}
        />
      </div>
      <Button type="submit" variant="primary">
        検索
      </Button>
      <Button type="button" onClick={form.handleClear}>
        条件をクリア
      </Button>
    </form>
  );
}

export { UserFilters };
