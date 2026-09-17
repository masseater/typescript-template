import { IntlProvider, ThemeProvider, createTheme } from "smarthr-ui";
import type { ReactElement, ReactNode, ReactPortal } from "react";

const theme = createTheme();

function UIProvider({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <IntlProvider locale="ja">{children}</IntlProvider>
    </ThemeProvider>
  );
}

export { UIProvider };
