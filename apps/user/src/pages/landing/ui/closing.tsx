import { Heading, buttonVariants } from "@template/ui/ui";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

function Closing(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <Heading as="h2">さっそく始めましょう</Heading>
      <Link to="/signup" className={buttonVariants({ size: "large", variant: "primary" })}>
        新規登録
      </Link>
    </section>
  );
}

export { Closing };
