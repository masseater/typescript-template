import type { ReactElement } from "react";

import { Card, Heading } from "@repo/ui";

function Feature({
  description,
  icon,
  title,
}: Readonly<{ description: string; icon: ReactElement; title: string }>): ReactElement {
  return (
    <li className="flex">
      <Card>
        {icon}
        <Heading as="h3" size="block">
          {title}
        </Heading>
        <p className="text-base leading-normal text-muted-foreground">{description}</p>
      </Card>
    </li>
  );
}

export { Feature };
