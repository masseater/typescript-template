import { Card, Heading } from "@template/ui";

import type { ReactElement } from "react";

const Feature = ({
  description,
  icon,
  title,
}: Readonly<{ description: string; icon: ReactElement; title: string }>): ReactElement => {
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
};

export { Feature };
