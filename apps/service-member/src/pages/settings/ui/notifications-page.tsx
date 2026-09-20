import {
  Button,
  CheckboxField,
  FormColumn,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  useAction,
  useToast,
} from "@repo/ui";
import { useState } from "react";

import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from "#pages/notifications/api/notifications.ts";

import type { NotificationPreferences } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function NotificationsPage({
  initial,
}: Readonly<{ initial: NotificationPreferences }>): ReactElement {
  const notify = useToast();
  const saveAction = useAction();
  const [messageMail, setMessageMail] = useState(initial.messageMail);
  const [boardMail, setBoardMail] = useState(initial.boardMail);

  const save = (): void => {
    saveAction.run(async () => {
      const saved = await saveNotificationPreferences({ boardMail, messageMail });
      setMessageMail(saved.messageMail);
      setBoardMail(saved.boardMail);
      notify("success", "通知設定を保存しました。");
    });
  };

  return (
    <Page title="通知">
      {saveAction.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{saveAction.error}</StatusMessage>
      )}
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
        <Button disabled={saveAction.blocked} onClick={save} type="button" variant="primary">
          保存
        </Button>
      </FormColumn>
    </Page>
  );
}

async function loadSettingsNotificationsPage(): Promise<NotificationPreferences> {
  return loadNotificationPreferences();
}

export { NotificationsPage, loadSettingsNotificationsPage };
