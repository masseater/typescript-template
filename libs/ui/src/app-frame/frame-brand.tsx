import { NavigationLink } from "../shared/ui/navigation-link.tsx";

import type { ReactElement } from "react";

const FrameBrand = ({
  collapsed,
  compact,
  homeTo,
  mark,
  productName,
  subtitle,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  homeTo: string | undefined;
  mark: string;
  productName: string;
  subtitle: string | undefined;
}>): ReactElement => {
  if (collapsed) {
    return (
      <div className="border-b border-border px-2 py-3 text-center">
        <p className="text-sm leading-tight font-bold text-foreground">
          <span className="sr-only">{productName}</span>
          <span aria-hidden="true">{mark}</span>
        </p>
      </div>
    );
  }
  const productClass = compact
    ? "text-sm leading-tight font-bold text-foreground"
    : "text-base leading-tight font-bold text-foreground";
  return (
    <div className={`border-b border-border py-3 ${compact ? "px-2 text-center" : "px-3"}`}>
      {homeTo === undefined || compact ? (
        <p className={productClass}>{productName}</p>
      ) : (
        <NavigationLink to={homeTo} variant="brand">
          {productName}
        </NavigationLink>
      )}
      {subtitle === undefined ? null : (
        <p className="text-sm leading-tight text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
};

export { FrameBrand };
