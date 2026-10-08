import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useOrders() {
  const api = useApi();
  const qc  = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await api.get("/orders");
      return data.orders || [];
    },
  });

  return { orders: data || [], isLoading, isError };
}

export function useOrder(orderId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}`);
      return data.order;
    },
    enabled: !!orderId,
  });
}
