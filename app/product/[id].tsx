import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/hooks/useProduct";
import useCart from "@/hooks/useCart";
import { useReviews } from "@/hooks/useReviews";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, Dimensions, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney, formatDate } from "@/lib/utils";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();
  const { data: product, isLoading } = useProduct(id);
  const { addToCartAsync, isAddingToCart } = useCart();
  const { reviews, avgRating } = useReviews(id);
  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);

  const images = product ? (Array.isArray(product.images) ? product.images : (typeof product.images === "string" ? JSON.parse(product.images || "[]") : [])) : [];

  const handleAddToCart = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    setAdding(true);
    try {
      await addToCartAsync({ productId: id });
      Alert.alert("Added to Cart! 🛒", `${product?.name} has been added to your cart.`, [
        { text: "View Cart", onPress: () => router.push("/(tabs)/cart") },
        { text: "Keep Shopping", style: "cancel" },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Couldn't add to cart.");
    } finally {
      setAdding(false);
    }
  };

  const contactSupport = async () => {
    // Policy: customers chat with OneDelivery support (admin) only — never
    // directly with sellers. Support relays any product questions.
    router.push({
      pathname: "/conversation/new",
      params: { recipientId: "admin", productId: id },
    } as any);
  };

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="light" />
      <ActivityIndicator color="#F97316" size="large" />
    </View>
  );

  if (!product) return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="light" />
      <Text style={{ color: "#64748B" }}>Product not found.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Image carousel */}
        <View style={{ backgroundColor: "#1E293B", position: "relative" }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {images.length > 0 ? images.map((img: string, i: number) => (
              <Image key={i} source={{ uri: img }} style={{ width, height: 320, backgroundColor: "#334155" }} contentFit="cover" />
            )) : (
              <Image source={require("../../assets/images/onedelivery-logo.png")} style={{ width, height: 320, backgroundColor: "#334155" }} contentFit="contain" />
            )}
          </ScrollView>
          {/* Dots */}
          {images.length > 1 && (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, position: "absolute", bottom: 12, left: 0, right: 0 }}>
              {images.map((_: any, i: number) => (
                <View key={i} style={{ width: i === activeImg ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeImg ? "#F97316" : "#64748B" }} />
              ))}
            </View>
          )}
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()}
            style={{ position: "absolute", top: insets.top + 10, left: 14, backgroundColor: "#0F172ABB", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "#334155" }}>
            <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
          </TouchableOpacity>
          {/* Featured badge */}
          {product.is_featured && (
            <View style={{ position: "absolute", top: insets.top + 10, right: 14, backgroundColor: "#F97316", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>⭐ FEATURED</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 20 }}>
          {/* Name + price */}
          <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "900", lineHeight: 28, marginBottom: 8 }}>{product.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: "#F97316", fontSize: 28, fontWeight: "900" }}>{formatMoney(product.price)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ backgroundColor: product.stock > 0 ? "#22C55E20" : "#EF444420", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: product.stock > 0 ? "#22C55E" : "#EF4444", fontSize: 12, fontWeight: "700" }}>
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </Text>
              </View>
            </View>
          </View>

          {/* Rating */}
          {product.avg_rating > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <View style={{ flexDirection: "row" }}>
                {[1,2,3,4,5].map((i) => (
                  <Text key={i} style={{ color: i <= Math.round(product.avg_rating) ? "#F59E0B" : "#334155", fontSize: 16 }}>★</Text>
                ))}
              </View>
              <Text style={{ color: "#94A3B8", fontSize: 14 }}>{parseFloat(product.avg_rating).toFixed(1)} ({product.total_reviews} reviews)</Text>
            </View>
          )}

          {/* Seller info */}
          {product.seller_name && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#1E293B", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#334155" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F9731620", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="storefront-outline" size={20} color="#F97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#F8FAFC", fontWeight: "700" }}>{product.seller_name}</Text>
                {product.shop_address && <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }} numberOfLines={1}>{product.shop_address}</Text>}
              </View>
              <TouchableOpacity onPress={contactSupport} style={{ backgroundColor: "#F9731620", borderRadius: 10, padding: 8, borderWidth: 1, borderColor: "#F9731640" }}>
                <Ionicons name="chatbubble-outline" size={18} color="#F97316" />
              </TouchableOpacity>
            </View>
          )}

          {/* Description */}
          {product.description && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "800", marginBottom: 10 }}>Description</Text>
              <Text style={{ color: "#94A3B8", lineHeight: 22, fontSize: 14 }}>{product.description}</Text>
            </View>
          )}

          {/* Category */}
          {product.category_name && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 }}>
              <View style={{ backgroundColor: "#1E293B", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#334155" }}>
                <Text style={{ color: "#94A3B8", fontSize: 12 }}>📦 {product.category_name}</Text>
              </View>
            </View>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <View>
              <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "800", marginBottom: 12 }}>Customer Reviews</Text>
              <View style={{ gap: 12 }}>
                {reviews.slice(0, 5).map((r: any) => (
                  <View key={r.id} style={{ backgroundColor: "#1E293B", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#334155" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#F8FAFC", fontWeight: "700" }}>{r.reviewer_name?.[0]?.toUpperCase()}</Text>
                        </View>
                        <Text style={{ color: "#F8FAFC", fontWeight: "600" }}>{r.reviewer_name}</Text>
                      </View>
                      <View style={{ flexDirection: "row" }}>
                        {[1,2,3,4,5].map((i) => (
                          <Text key={i} style={{ color: i <= r.rating ? "#F59E0B" : "#334155", fontSize: 12 }}>★</Text>
                        ))}
                      </View>
                    </View>
                    {r.comment && <Text style={{ color: "#94A3B8", fontSize: 13, lineHeight: 18 }}>{r.comment}</Text>}
                    <Text style={{ color: "#475569", fontSize: 11, marginTop: 6 }}>{formatDate(r.created_at)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: "#0F172A", borderTopWidth: 1, borderTopColor: "#1E293B", flexDirection: "row", gap: 12 }}>
        <TouchableOpacity onPress={contactSupport}
          style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155" }}>
          <Ionicons name="chatbubble-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={adding || isAddingToCart || product.stock === 0}
          style={{ flex: 1, backgroundColor: product.stock === 0 ? "#334155" : "#F97316", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
          {(adding || isAddingToCart) ? <ActivityIndicator color="#fff" /> : <Ionicons name="cart-outline" size={20} color="#fff" />}
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
            {product.stock === 0 ? "Out of Stock" : (adding || isAddingToCart) ? "Adding…" : "Add to Cart"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
