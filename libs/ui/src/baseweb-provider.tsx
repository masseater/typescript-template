import { useAtom } from "@effect/atom-react";
import { BaseProvider } from "baseui";
import { Atom } from "effect/unstable/reactivity";
import { useId, type ReactElement } from "react";
import { Client as StyletronClient, Server as StyletronServer } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";

import { appTheme } from "./baseweb-theme";

import type { Children } from "./shared/ui/types";

const isBrowser = (): boolean => {
  return typeof document !== "undefined";
};

const createEngine = (): StyletronClient | StyletronServer => {
  if (isBrowser()) {
    return new StyletronClient({
      hydrate: document.getElementsByClassName("styletron"),
    });
  }
  return new StyletronServer();
};

const styleEngineAtom = Atom.family((slotId: string) => {
  void slotId;
  return Atom.make(createEngine());
});

const StyletronSheets = ({ sheetsHtml }: Readonly<{ sheetsHtml: string }>): ReactElement => {
  return <div dangerouslySetInnerHTML={{ __html: sheetsHtml }} />;
};

const BaseWebProvider = ({ children }: Children): ReactElement => {
  const [engine] = useAtom(styleEngineAtom(useId()));
  const sheetsHtml =
    isBrowser() || !(engine instanceof StyletronServer)
      ? undefined
      : engine.getStylesheetsHtml("styletron");
  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={appTheme}>
        {children}
        {sheetsHtml === undefined ? null : <StyletronSheets sheetsHtml={sheetsHtml} />}
      </BaseProvider>
    </StyletronProvider>
  );
};

export { BaseWebProvider };
