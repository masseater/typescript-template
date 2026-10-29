import type { ReactNode } from "react";

const FeatureCard = ({ title, body }: Readonly<{ title: string; body: string }>): ReactNode => (
  <li className="bg-card border-border rounded-lg border p-5">
    <h3 className="mb-2 font-semibold">{title}</h3>
    <p className="text-muted-foreground text-sm">{body}</p>
  </li>
);

export { FeatureCard };
