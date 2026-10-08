import useCart from "@/hooks/useCart";
import useWishlist from "@/hooks/useWishlist";
import { Product } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";

interface ProductsGridProps {
  isLoading: boolean;
  isError: boolean;
  products: Product[];
}

const ProductsGrid = ({ products, isLoading, isError }: ProductsGridProps) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isAddingToCart, addToCart } = useCart();

  const handleAddToCart = (productId: string, productName: string) => {
    addToCart(
      { productId, quantity: 1 },
      {
        onSuccess: () => Alert.alert("Added!", `${productName} added to cart`),
        onError: (error: any) => Alert.alert("Error", error?.response?.data?.error || "Failed to add to cart"),
      }
    );
  };

  const renderProduct = ({ item: product }: { item: Product }) => {
    const images = Array.isArray(product.images) ? product.images : [];
    const imageUri = images[0] || "";
    const rating = product.averageRating || 0;
    const reviews = product.totalReviews || 0;

    return (
      <TouchableOpacity
        style={{ width: "48%", marginBottom: 12, backgroundColor: "#1E293B", borderRadius: 18, overflow: "hidden" }}
        activeOpacity={0.85}
        onPress={() => router.push(`/product/${product._id}`)}
      >
        <View style={{ position: "relative" }}>
          <Image
            source={imageUri ? { uri: imageUri } : require("@/assets/images/onedelivery-logo.png")}
            style={{ width: "100%", height: 160, backgroundColor: "#334155" }}
            contentFit="cover"
            transition={200}
          />
          <TouchableOpacity
            style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20, padding: 6 }}
            onPress={() => toggleWishlist(product._id)}
          >
            <Ionicons
              name={isInWishlist(product._id) ? "heart" : "heart-outline"}
              size={16}
              color={isInWishlist(product._id) ? "#EF4444" : "#fff"}
            />
          </TouchableOpacity>
          {product.stock === 0 && (
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 4 }}>
              <Text style={{ color: "#EF4444", textAlign: "center", fontSize: 11, fontWeight: "700" }}>Out of Stock</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 10 }}>
          <Text style={{ color: "#94A3B8", fontSize: 10, marginBottom: 2 }}>{product.category}</Text>
          <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 13, marginBottom: 4 }} numberOfLines={2}>
            {product.name}
          </Text>

          {reviews > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={{ color: "#F8FAFC", fontSize: 10, marginLeft: 2 }}>{rating.toFixed(1)}</Text>
              <Text style={{ color: "#64748B", fontSize: 10, marginLeft: 2 }}>({reviews})</Text>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "#64748B", fontSize: 9 }}>TZS</Text>
              <Text style={{ color: "#F97316", fontWeight: "800", fontSize: 14 }}>
                {product.price.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: product.stock === 0 ? "#334155" : "#F97316", borderRadius: 10, width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
              onPress={() => product.stock > 0 && handleAddToCart(product._id, product.name)}
              disabled={isAddingToCart || product.stock === 0}
            >
              {isAddingToCart
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="add" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) return (
    <View style={{ paddingVertical: 60, alignItems: "center" }}>
      <ActivityIndicator size="large" color="#F97316" />
      <Text style={{ color: "#94A3B8", marginTop: 12 }}>Loading products...</Text>
    </View>
  );

  if (isError) return (
    <View style={{ paddingVertical: 60, alignItems: "center" }}>
      <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
      <Text style={{ color: "#F8FAFC", fontWeight: "600", marginTop: 12 }}>Failed to load products</Text>
      <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>Check your internet connection</Text>
    </View>
  );

  return (
    <FlatList
      data={products}
      renderItem={renderProduct}
      keyExtractor={(item) => item._id}
      numColumns={2}
      columnWrapperStyle={{ justifyContent: "space-between" }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
      ListEmptyComponent={
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <Ionicons name="cube-outline" size={48} color="#334155" />
          <Text style={{ color: "#94A3B8", marginTop: 12, fontWeight: "600" }}>No products found</Text>
          <Text style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>Try a different category or search</Text>
        </View>
      }
    />
  );
};

export default ProductsGrid;
