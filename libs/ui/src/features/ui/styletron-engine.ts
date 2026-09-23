import { Atom } from "effect/unstable/reactivity";
import { Client as StyletronClient, Server as StyletronServer } from "styletron-engine-monolithic";

const styletronHydrateClass = "_styletron_hydrate_";

const styleSheetsAtom = Atom.family((slotId: string) => {
  void slotId;
  return Atom.make<readonly Readonly<{ css: string; hydrate: string }>[]>([]);
});

const styleEngineAtom = Atom.family((slotId: string) => {
  void slotId;
  return Atom.make(
    (_get): StyletronClient | StyletronServer =>
      new StyletronClient({
        hydrate: document.getElementsByClassName(styletronHydrateClass),
      }),
  ).pipe(Atom.withServerValue(() => new StyletronServer()));
});

export { styleEngineAtom, styleSheetsAtom, styletronHydrateClass };
