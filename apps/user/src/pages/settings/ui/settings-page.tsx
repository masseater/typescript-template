import { CardLink, Heading, Page } from "@repo/ui";

import { settingsItems } from "#pages/settings/model/items.ts";

import type { ReactElement } from "react";

function SettingsPage(): ReactElement {
  return (
    <Page title="設定">
      <ul className="flex flex-col gap-2">
        {settingsItems.map((listedSetting) => (
          <li key={listedSetting.to}>
            <CardLink to={listedSetting.to}>
              <Heading size="block">{listedSetting.label}</Heading>
            </CardLink>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export { SettingsPage };
