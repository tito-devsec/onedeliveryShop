import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useProducts(params?: { category?: string; search?: string; featured?: boolean; page?: number }) {
  const api = useApi();
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params?.category) q.set("category", params.category);
      if (params?.search)   q.set("search", params.search);
      if (params?.featured) q.set("featured", "1");
      if (params?.page)     q.set("page", String(params.page));
      const { data } = await api.get(`/products?${q.toString()}`);
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCategories() {
  const api = useApi();
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/admin/categories");
      return data.categories || [];
    },
    staleTime: 5 * 60_000,
  });
}
