import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const useWishlist = () => {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const qc  = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wishlist"],
    enabled: isSignedIn,
    queryFn: async () => {
      const { data } = await api.get("/users/wishlist");
      return data.wishlist || [];
    },
  });

  const wishlist = data || [];
  const wishlistIds = new Set(wishlist.map((p: any) => p.id || p.product_id));

  const addMutation = useMutation({
    mutationFn: (productId: string) => api.post(`/users/wishlist/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/users/wishlist/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const toggleWishlist = (productId: string) => {
    if (wishlistIds.has(productId)) {
      removeMutation.mutate(productId);
    } else {
      addMutation.mutate(productId);
    }
  };

  return {
    wishlist,
    isLoading,
    isError,
    isInWishlist: (id: string) => wishlistIds.has(id),
    addToWishlist: addMutation.mutate,
    removeFromWishlist: removeMutation.mutate,
    toggleWishlist,
    isRemoving: removeMutation.isPending,
    isAdding:   addMutation.isPending,
  };
};

export default useWishlist;
