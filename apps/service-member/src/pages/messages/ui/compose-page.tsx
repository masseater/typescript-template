import { Button, Field, FormColumn, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { useComposeForm } from "#pages/messages/model/compose-form.ts";
import { maximumMessageBodyLength } from "#shared/contracts/index.ts";
import { ConversationBody } from "./conversation-body.tsx";

import type { ReactElement } from "react";
function ComposePage({
  peerId,
  peerName,
}: Readonly<{
  peerId: string;
  peerName: string;
}>): ReactElement {
  const router = useRouter();
  const form = useComposeForm(
    peerId,
    (conversationId) =>
      router
        .navigate({
          params: {
            id: conversationId,
          },
          to: "/messages/$id",
        })
        .then(() => undefined),
    () =>
      router
        .navigate({
          to: "/upgrade",
        })
        .then(() => undefined),
  );
  return (
    <ConversationBody>
      <Heading as="h2" size="section">
        {peerName}
      </Heading>
      <form aria-busy={form.pending} onSubmit={form.handleSubmit}>
        <FormColumn>
          <Field
            label="メッセージ"
            maxLength={maximumMessageBodyLength}
            multiline
            name="body"
            onValueChange={form.handleBodyChange}
            value={form.body}
          />
          <div>
            <Button disabled={form.blocked} type="submit" variant="primary">
              送信する
            </Button>
          </div>
          {form.error !== undefined && (
            <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
          )}
        </FormColumn>
      </form>
    </ConversationBody>
  );
}
export { ComposePage };
