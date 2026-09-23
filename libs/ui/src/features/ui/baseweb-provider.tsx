import { useAtomValue } from "@effect/atom-react";
import { BaseProvider } from "baseui";
import { useId, type ReactElement } from "react";
import { Provider as StyletronProvider } from "styletron-react";

import { appTheme } from "./baseweb-theme";
import { styleEngineAtom } from "./styletron-engine";
import { StyletronSheets } from "./styletron-sheets";

import type { Children } from "./shared/ui/types";

const BaseWebProvider = ({ children }: Children): ReactElement => {
  const slotId = useId();
  const engine = useAtomValue(styleEngineAtom(slotId));
  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={appTheme}>
        {children}
        <StyletronSheets slotId={slotId} />
      </BaseProvider>
    </StyletronProvider>
  );
};

export { BaseWebProvider };
