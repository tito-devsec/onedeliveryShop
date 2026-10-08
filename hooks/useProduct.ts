import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useProduct(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`);
      return data.product;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
