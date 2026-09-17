import type { ComponentProps, ReactElement, ReactNode } from "react";
import { useId } from "react";
import { createTheme, ThemeProvider, IntlProvider, Stack, PageHeading, Input } from "smarthr-ui";

const theme = createTheme();

export function UIProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <IntlProvider locale="ja">{children}</IntlProvider>
    </ThemeProvider>
  );
}

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main>
      <Stack>
        <PageHeading>{title}</PageHeading>
        {children}
      </Stack>
    </main>
  );
}

export function Field({
  label,
  ...props
}: Omit<ComponentProps<typeof Input>, "id"> & { label: string }) {
  const id = useId();
  return (
    <Stack>
      <label htmlFor={id}>{label}</label>
      <Input {...props} id={id} />
    </Stack>
  );
}

export function Status({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
      {children}
    </p>
  );
}
