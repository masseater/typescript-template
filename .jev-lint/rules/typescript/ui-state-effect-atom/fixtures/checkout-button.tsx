import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { api } from "#/shared/api";

const MESSAGES = {
  idle: "",
  pending: "Placing the order.",
  success: "The order was placed.",
  error: "The order could not be placed.",
} as const;

const CheckoutButton = ({ cartId }: { cartId: string }): ReactNode => {
  const { mutate, status } = useMutation({
    mutationFn: () => api.orders.post({ cartId }),
  });
  return (
    <div>
      <button type="button" disabled={status === "pending"} onClick={() => mutate()}>
        Place order
      </button>
      <p role="status">{MESSAGES[status]}</p>
    </div>
  );
};

export { CheckoutButton };
