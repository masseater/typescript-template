import { localState } from "./local-state";
import { Button } from "./shared/ui/button";

import type { ReactElement } from "react";
import type { UiNode } from "./shared/ui/types";

const useInviting = localState(false);

const InvitationBoard = ({
  children,
  form,
}: Readonly<{ children: UiNode; form: UiNode }>): ReactElement => {
  const [inviting, setInviting] = useInviting();
  return (
    <>
      <div>
        <Button
          type="button"
          variant="primary"
          aria-expanded={inviting}
          onClick={() => {
            setInviting((open) => !open);
          }}
        >
          {"招待する"}
        </Button>
      </div>
      {inviting ? form : null}
      {children}
    </>
  );
};

export { InvitationBoard };
