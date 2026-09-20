import { Button, Field, SelectField } from "@repo/ui";

import { useUserFilterForm } from "#pages/users/model/user-filter-form.ts";
import { roleOptions, verificationOptions } from "#pages/users/model/user-labels.ts";
import { maximumKeywordLength } from "#shared/contracts/index.ts";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { ReactElement } from "react";

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
          maxLength={maximumKeywordLength}
          value={form.keyword}
          onValueChange={form.handleKeywordChange}
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
          options={verificationOptions}
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
