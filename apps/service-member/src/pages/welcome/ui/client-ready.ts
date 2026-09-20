import { noop } from "es-toolkit";
import { useSyncExternalStore } from "react";

const subscribeNothing = (): (() => void) => {
  return noop;
};

const clientSnapshot = (): boolean => {
  return true;
};

const serverSnapshot = (): boolean => {
  return false;
};

function useClientReady(): boolean {
  return useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
}

export { useClientReady };
