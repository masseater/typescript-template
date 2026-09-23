import { useStyletron } from "baseui";

import type { ReactElement } from "react";

const Separator = ({ label }: Readonly<{ label: string }>): ReactElement => {
  const [css, theme] = useStyletron();
  return (
    <div
      data-slot="separator"
      className={css({
        alignItems: "center",
        color: theme.colors.contentSecondary,
        display: "flex",
        fontSize: theme.sizing.scale550,
        gap: theme.sizing.scale300,
        lineHeight: theme.sizing.scale700,
        width: "100%",
      })}
    >
      <hr
        className={css({
          backgroundColor: theme.colors.borderOpaque,
          border: "none",
          flex: 1,
          height: "1px",
          margin: 0,
        })}
      />
      <span>{label}</span>
      <hr
        className={css({
          backgroundColor: theme.colors.borderOpaque,
          border: "none",
          flex: 1,
          height: "1px",
          margin: 0,
        })}
      />
    </div>
  );
};

export { Separator };
