import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useAddresses() {
  const api = useApi();
  const qc  = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => {
      const { data } = await api.get("/users/addresses");
      return data.addresses || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: (addr: any) => api.post("/users/addresses", addr),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: addr }: { id: string; data: any }) => api.put(`/users/addresses/${id}`, addr),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return {
    addresses: data || [],
    isLoading,
    isError,
    addAddress: addMutation.mutate,
    updateAddress: updateMutation.mutate,
    deleteAddress: deleteMutation.mutate,
    isAddingAddress:   addMutation.isPending,
    isUpdatingAddress: updateMutation.isPending,
    isDeletingAddress: deleteMutation.isPending,
  };
}
