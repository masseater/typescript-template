import { Toast } from "@base-ui/react/toast";
import { useCallback } from "react";

function useNotify(): (message: string) => void {
  const { add } = Toast.useToastManager();
  return useCallback(
    (message: string): void => {
      add({ title: message });
    },
    [add],
  );
}

export { useNotify };
