import { noop } from "es-toolkit";
import { useSyncExternalStore } from "react";

function subscribeNothing(): () => void {
  return noop;
}

function clientSnapshot(): boolean {
  return true;
}

function serverSnapshot(): boolean {
  return false;
}

function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
}

export { useHydrated };
