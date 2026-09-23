import { resultError } from "@repo/ui";

import { useFlagList } from "#pages/flags/model/flag-list.ts";
import { FlagsView } from "./flags-view.tsx";

import type { ReactElement } from "react";

function FlagsPage(): ReactElement {
  const { flags, listing, reload, toggle } = useFlagList();
  return (
    <FlagsView failure={resultError(listing)} flags={flags} onReload={reload} onToggle={toggle} />
  );
}

export { FlagsPage };
