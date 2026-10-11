import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

type Invoice = { id: string; total: number };

type InvoiceDialog =
  | { status: "closed" }
  | { status: "viewing"; invoice: Invoice }
  | { status: "confirmingDelete"; invoice: Invoice };

const invoiceDialogAtom = Atom.make<InvoiceDialog>({ status: "closed" });

const useInvoiceDialog = (): InvoiceDialog => useAtomValue(invoiceDialogAtom);

const useSetInvoiceDialog = (): ((dialog: InvoiceDialog) => void) => useAtomSet(invoiceDialogAtom);

export type { InvoiceDialog };
export { useInvoiceDialog, useSetInvoiceDialog };
