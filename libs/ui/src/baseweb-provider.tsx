import { useAtom, useAtomValue } from "@effect/atom-react";
import { BaseProvider } from "baseui";
import { Atom } from "effect/unstable/reactivity";
import { useId, type ReactElement } from "react";
import { Client as StyletronClient, Server as StyletronServer } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";

import { appTheme } from "./baseweb-theme";

import type { Children } from "./shared/ui/types";

const styletronClass = "styletron";

type StyletronSheet = {
  readonly css: string;
  readonly hydrate: string;
};

const sheetsMatch = (left: readonly StyletronSheet[], right: readonly StyletronSheet[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (const [index, sheet] of left.entries()) {
    const other = right[index];
    if (other === undefined || sheet.css !== other.css || sheet.hydrate !== other.hydrate) {
      return false;
    }
  }
  return true;
};

const sheetsFromServer = (engine: StyletronServer): readonly StyletronSheet[] => {
  return engine.getStylesheets().map((sheet) => {
    return {
      css: sheet.css,
      hydrate: sheet.attrs["data-hydrate"] ?? "",
    };
  });
};

const styleSheetsAtom = Atom.family((slotId: string) => {
  void slotId;
  return Atom.make<readonly StyletronSheet[]>([]);
});

const styleEngineAtom = Atom.family((slotId: string) => {
  void slotId;
  return Atom.make(
    (_get): StyletronClient | StyletronServer =>
      new StyletronClient({
        hydrate: document.getElementsByClassName(styletronClass),
      }),
  ).pipe(Atom.withServerValue(() => new StyletronServer()));
});

const StyletronSheets = ({
  engine,
  slotId,
}: Readonly<{
  engine: StyletronClient | StyletronServer;
  slotId: string;
}>): ReactElement => {
  const [sheets, setSheets] = useAtom(styleSheetsAtom(slotId));
  const rendered =
    engine instanceof StyletronServer ? sheetsFromServer(engine) : sheets;
  if (engine instanceof StyletronServer && !sheetsMatch(sheets, rendered)) {
    setSheets(rendered);
  }
  return (
    <>
      {rendered.map((sheet) => (
        <style className={styletronClass} data-hydrate={sheet.hydrate} key={sheet.hydrate}>
          {sheet.css}
        </style>
      ))}
    </>
  );
};

const BaseWebProvider = ({ children }: Children): ReactElement => {
  const slotId = useId();
  const engine = useAtomValue(styleEngineAtom(slotId));
  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={appTheme}>
        {children}
        <StyletronSheets engine={engine} slotId={slotId} />
      </BaseProvider>
    </StyletronProvider>
  );
};

export { BaseWebProvider };
