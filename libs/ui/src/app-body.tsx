import { RegistryProvider } from "@effect/atom-react";
import { Scripts } from "@tanstack/react-router";

import { BaseWebProvider } from "./baseweb-provider";
import { MotionProvider } from "./motion-provider";

import type { ReactElement } from "react";
import type { Children } from "./shared/ui/types";

const AppBody = ({ children }: Children): ReactElement => {
  return (
    <body>
      <BaseWebProvider>
        <RegistryProvider>
          <MotionProvider>{children}</MotionProvider>
        </RegistryProvider>
      </BaseWebProvider>
      <Scripts />
    </body>
  );
};

export { AppBody };
