import { useEffect, useState } from "react";

type Order = { id: string; total: number };

export function OrderPanel({ orderId }: { orderId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((data: Order) => {
        setOrder(data);
        setIsEmpty(!data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
  }, [orderId]);

  if (isLoading) return <p>Loading</p>;
  if (isError) return <p>Error</p>;
  return <p>{order?.total}</p>;
}
