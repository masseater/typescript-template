import { GROUP_JOIN_POLICY } from "@repo/config";
import {
  Button,
  ButtonLink,
  Field,
  FormColumn,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  useToast,
} from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { useCreateGroupForm } from "#pages/messages/model/create-group-form.ts";

import type { ReactElement } from "react";

function CreateGroupForm(): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  async function showCreated(groupId: string): Promise<void> {
    await router.invalidate();
    await navigate({ params: { id: groupId }, to: "/groups/$id" });
    notify("success", "グループを作りました。");
  }
  const form = useCreateGroupForm(showCreated);
  return (
    <section aria-labelledby="new-group-heading" className="flex flex-col gap-4">
      <Heading as="h2" size="section">
        <span id="new-group-heading">グループを作る</span>
      </Heading>
      <FormColumn>
        <Field
          label="グループ名"
          name="name"
          required
          maxLength={100}
          value={form.name}
          onValueChange={form.handleNameChange}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="button"
            variant="primary"
            disabled={form.blocked}
            onClick={() => form.submit(GROUP_JOIN_POLICY.invite)}
          >
            招待制で作る
          </Button>
          <Button
            type="button"
            disabled={form.blocked}
            onClick={() => form.submit(GROUP_JOIN_POLICY.open)}
          >
            自由参加で作る
          </Button>
          <ButtonLink to="/messages" search={{}}>
            やめる
          </ButtonLink>
        </div>
        {form.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
        )}
      </FormColumn>
    </section>
  );
}

export { CreateGroupForm };
