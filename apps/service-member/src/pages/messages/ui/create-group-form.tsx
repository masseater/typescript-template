import { GROUP_JOIN_POLICY } from "@repo/config";
import { Button, Field, FormColumn, SelectField, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useCreateGroupForm } from "#pages/messages/model/create-group-form.ts";
import { maximumGroupNameLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

const policyOptions = [
  { label: "招待のみ", value: GROUP_JOIN_POLICY.invite },
  { label: "誰でも参加", value: GROUP_JOIN_POLICY.open },
] as const;

function CreateGroupForm(): ReactElement {
  const form = useCreateGroupForm();
  return (
    <form aria-label="グループを作る" onSubmit={form.handleSubmit}>
      <FormColumn>
        <Field
          label="グループ名"
          name="name"
          required
          maxLength={maximumGroupNameLength}
          value={form.name}
          onValueChange={form.handleNameChange}
        />
        <SelectField
          label="参加方法"
          name="joinPolicy"
          onValueChange={form.handlePolicyChange}
          options={policyOptions}
          value={form.policy}
        />
        <div>
          <Button disabled={form.blocked} type="submit" variant="primary">
            グループを作る
          </Button>
        </div>
        {form.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
        )}
      </FormColumn>
    </form>
  );
}

export { CreateGroupForm };
