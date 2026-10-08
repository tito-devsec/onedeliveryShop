import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const useCart = () => {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const qc  = useQueryClient();

  const { data: cart, isLoading, isError } = useQuery({
    queryKey: ["cart"],
    enabled: isSignedIn,
    queryFn: async () => {
      const { data } = await api.get("/cart");
      return data; // { items, total, count }
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      const { data } = await api.post("/cart", { product_id: productId, quantity });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const { data } = await api.put(`/cart/${itemId}`, { quantity });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/cart/${itemId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => { await api.delete("/cart"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  return {
    cart,
    items: cart?.items || [],
    total: cart?.total || 0,
    cartItemCount: cart?.count || 0,
    isLoading,
    isError,
    addToCart: addToCartMutation.mutate,
    addToCartAsync: addToCartMutation.mutateAsync,
    updateQuantity: updateQuantityMutation.mutate,
    removeFromCart: removeFromCartMutation.mutate,
    clearCart: clearCartMutation.mutate,
    isAddingToCart: addToCartMutation.isPending,
    isUpdating:     updateQuantityMutation.isPending,
    isRemoving:     removeFromCartMutation.isPending,
  };
};

export default useCart;
