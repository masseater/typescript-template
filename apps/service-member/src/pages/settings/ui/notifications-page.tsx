import { CheckboxField, FormColumn, Page, StatusMessage, localState } from "@repo/ui";

import type { ReactElement } from "react";

const useMessageMail = localState(false);
const useBoardMail = localState(false);

function NotificationsPage(): ReactElement {
  const [messageMail, setMessageMail] = useMessageMail();
  const [boardMail, setBoardMail] = useBoardMail();
  return (
    <Page title="通知">
      <StatusMessage>通知の配信はまだありません。既定はオフです。</StatusMessage>
      <FormColumn>
        <CheckboxField
          checked={messageMail}
          label="メッセージのメール通知"
          onCheckedChange={setMessageMail}
        />
        <CheckboxField
          checked={boardMail}
          label="掲示板のメール通知"
          onCheckedChange={setBoardMail}
        />
      </FormColumn>
    </Page>
  );
}

export { NotificationsPage };
