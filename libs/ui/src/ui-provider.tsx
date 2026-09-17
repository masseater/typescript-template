import { IntlProvider, ThemeProvider, createTheme } from "smarthr-ui";
import type { ReactElement, ReactNode } from "react";

const theme = createTheme();

function UIProvider({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <IntlProvider locale="ja">{children}</IntlProvider>
    </ThemeProvider>
  );
}

export { UIProvider };
