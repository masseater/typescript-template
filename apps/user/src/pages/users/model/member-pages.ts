import { memberPageSize } from "@template/runtime/contracts";

function nextMemberPage(loadedPages: number, total: number): number | undefined {
  return loadedPages * memberPageSize < total ? loadedPages + 1 : undefined;
}

export { nextMemberPage };
