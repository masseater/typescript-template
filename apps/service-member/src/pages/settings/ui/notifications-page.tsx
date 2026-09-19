import { CheckboxField, FormColumn, Page, StatusMessage } from "@repo/ui";
import { useState } from "react";

import type { ReactElement } from "react";

function NotificationsPage(): ReactElement {
  const [messageMail, setMessageMail] = useState(false);
  const [boardMail, setBoardMail] = useState(false);
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
