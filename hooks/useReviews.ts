import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useReviews(productId?: string) {
  const api = useApi();
  const qc  = useQueryClient();

  const { data } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/product/${productId}`);
      return data;
    },
    enabled: !!productId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ productId, rating, comment }: { productId: string; rating: number; comment?: string }) => {
      const { data } = await api.post(`/reviews/product/${productId}`, { rating, comment });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });

  return {
    reviews: data?.reviews || [],
    avgRating: data?.avgRating || 0,
    createReview: createMutation.mutate,
    createReviewAsync: createMutation.mutateAsync,
    isCreatingReview: createMutation.isPending,
  };
}
