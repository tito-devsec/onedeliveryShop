import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/hooks/useProduct";
import useCart from "@/hooks/useCart";
import useWishlist from "@/hooks/useWishlist";
import { useReviews } from "@/hooks/useReviews";
import ProductCard, { parseImages } from "@/components/ProductCard";
import { useApi } from "@/lib/api";
import { requireSignIn } from "@/lib/authGate";
import { C } from "@/lib/theme";
import { formatDate, formatMoney } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(value) ? "star" : "star-outline"} size={size} color={C.star} />
      ))}
    </View>
  );
}

function Chip({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: color + "14", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const iconButton = { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: "center", justifyContent: "center" } as const;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const api = useApi();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: product, isLoading } = useProduct(id);
  const { addToCartAsync } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { reviews, avgRating, createReviewAsync, isCreatingReview } = useReviews(id);
  const [activeImg, setActiveImg] = useState(0);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState("");

  const { data: similar = [] } = useQuery({
    queryKey: ["similar", product?.category_id, id],
    queryFn: async () => {
      const { data } = await api.get(`/products?category=${product.category_id}&limit=10`);
      return (data.products || []).filter((p: any) => p.id !== id);
    },
    enabled: !!product?.category_id,
  });

  const here = `/product/${id}`;
  const images = product ? parseImages(product.images) : [];
  const rating = Number(avgRating) || Number(product?.avg_rating) || 0;
  const reviewCount = reviews.length || Number(product?.total_reviews) || 0;
  const soldOut = product?.stock === 0;

  const addToCart = async (thenCheckout = false) => {
    if (!user) return requireSignIn(here);
    setBusy(thenCheckout ? "buy" : "cart");
    try {
      await addToCartAsync({ productId: id });
      if (thenCheckout) router.push("/checkout");
      else Alert.alert("Added to cart", `${product?.name} is in your cart.`, [
        { text: "View cart", onPress: () => router.push("/(tabs)/cart") },
        { text: "Keep shopping", style: "cancel" },
      ]);
    } catch (err: any) {
      Alert.alert("Couldn't add to cart", err?.response?.data?.error || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  // Customers chat with OneDelivery support (admin) only — never directly with sellers
  const contactSupport = () => user
    ? router.push({ pathname: "/conversation/new", params: { recipientId: "admin", productId: id } } as any)
    : requireSignIn(here);

  const openReview = () => (user ? setReviewOpen(true) : requireSignIn(here));

  const submitReview = async () => {
    try {
      await createReviewAsync({ productId: id, rating: myRating, comment: myComment.trim() });
      qc.invalidateQueries({ queryKey: ["product", id] });
      setReviewOpen(false);
      setMyComment("");
      setMyRating(5);
      Alert.alert("Thank you!", "Your review has been posted.");
    } catch (err: any) {
      Alert.alert("Couldn't post review", err?.response?.data?.error || "Please try again.");
    }
  };

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="dark" />
      <ActivityIndicator color={C.navy} size="large" />
    </View>
  );

  if (!product) return (
    <View style={{ flex: 1, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="dark" />
      <Text style={{ color: C.textSecondary }}>Product not found.</Text>
    </View>
  );

  const liked = isInWishlist(id);

  return (
    <View style={{ flex: 1, backgroundColor: C.card }}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* Header + image gallery */}
        <View style={{ backgroundColor: C.well, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingTop: insets.top, paddingBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: "700", color: C.text, marginLeft: 4 }}>Product Details</Text>
            <TouchableOpacity onPress={contactSupport} style={iconButton}>
              <Ionicons name="chatbubble-ellipses-outline" size={19} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => (user ? toggleWishlist(id) : requireSignIn(here))} style={iconButton}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? C.red : C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {(images.length ? images : [null]).map((img, i) => (
              <Image key={i} source={img ? { uri: img } : require("../../assets/images/onedelivery-logo.png")}
                style={{ width, height: 280 }} contentFit="contain" transition={150} />
            ))}
          </ScrollView>
          {images.length > 1 && (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 }}>
              {images.map((_, i) => (
                <View key={i} style={{ width: i === activeImg ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeImg ? C.navy : "#CDD1DA" }} />
              ))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {product.is_featured ? <Chip icon="sparkles" label="Featured" color={C.green} /> : null}
            {product.category_name ? <Chip icon="pricetag-outline" label={product.category_name} color={C.navy} /> : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: "700", color: C.text, lineHeight: 26 }}>{product.name}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: C.orange, lineHeight: 26 }}>{formatMoney(product.price)}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Ionicons name="star" size={15} color={C.star} />
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>{rating ? rating.toFixed(1) : "New"}</Text>
            <Text style={{ color: C.border }}>|</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13 }}>{reviewCount} review{reviewCount === 1 ? "" : "s"}</Text>
            <Text style={{ color: C.border }}>|</Text>
            <Text style={{ color: soldOut ? C.red : C.green, fontSize: 13, fontWeight: "600" }}>{soldOut ? "Out of stock" : `${product.stock} in stock`}</Text>
          </View>

          {product.description ? (
            <Text style={{ color: C.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 14 }}>{product.description}</Text>
          ) : null}

          {product.seller_name ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: C.bg }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="storefront-outline" size={18} color={C.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.textMuted, fontSize: 11 }}>Sold by</Text>
                <Text style={{ color: C.text, fontWeight: "600" }} numberOfLines={1}>{product.seller_name}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {similar.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Similar Products</Text>
              <TouchableOpacity onPress={() => router.push(`/category/${product.category_id}`)}>
                <Text style={{ color: C.textSecondary, fontSize: 14 }}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {similar.map((p: any) => (
                <View key={p.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 17 }}>
                  <ProductCard product={p} width={148} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ marginTop: 26, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Reviews</Text>
              {rating > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Stars value={rating} size={13} />
                  <Text style={{ color: C.textSecondary, fontSize: 12 }}>{rating.toFixed(1)} out of 5</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={openReview} activeOpacity={0.8}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.navy, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Ionicons name="create-outline" size={16} color={C.navy} />
              <Text style={{ color: C.navy, fontWeight: "600", fontSize: 13 }}>Write a review</Text>
            </TouchableOpacity>
          </View>
          {reviews.length === 0 ? (
            <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
              No reviews yet. Bought this product? Be the first to share your experience.
            </Text>
          ) : reviews.slice(0, 10).map((r: any) => (
            <View key={r.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.well, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.navy, fontWeight: "700" }}>{r.reviewer_name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{r.reviewer_name}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11 }}>{formatDate(r.created_at)}</Text>
                </View>
                <Stars value={r.rating} size={13} />
              </View>
              {r.comment ? <Text style={{ color: C.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{r.comment}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity onPress={() => addToCart()} disabled={!!busy || soldOut} activeOpacity={0.85}
          style={{ flex: 1, borderWidth: 1.5, borderColor: C.navy, borderRadius: 14, paddingVertical: 15, alignItems: "center", opacity: soldOut ? 0.4 : 1 }}>
          {busy === "cart" ? <ActivityIndicator color={C.navy} /> : <Text style={{ color: C.navy, fontWeight: "700", fontSize: 16 }}>Add to Cart</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => addToCart(true)} disabled={!!busy || soldOut} activeOpacity={0.85}
          style={{ flex: 1, backgroundColor: soldOut ? C.textMuted : C.navy, borderRadius: 14, paddingVertical: 15, alignItems: "center" }}>
          {busy === "buy" ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{soldOut ? "Out of Stock" : "Buy Now"}</Text>}
        </TouchableOpacity>
      </View>

      {/* Write a review */}
      <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        {/* Lifts the sheet above the keyboard (the sheet's own bottom inset hides under it) */}
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-insets.bottom} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0000004D" }}>
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Rate this product</Text>
              <TouchableOpacity onPress={() => setReviewOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: C.textSecondary, marginTop: 4 }} numberOfLines={1}>{product.name}</Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginVertical: 20 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => setMyRating(i)} hitSlop={6}>
                  <Ionicons name={i <= myRating ? "star" : "star-outline"} size={36} color={C.star} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={myComment} onChangeText={setMyComment} multiline maxLength={500}
              placeholder="Share your experience (optional)" placeholderTextColor={C.textMuted}
              style={{ minHeight: 100, backgroundColor: C.bg, borderRadius: 14, padding: 14, color: C.text, fontSize: 14, textAlignVertical: "top" }} />
            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 8 }}>Only customers who bought this product can review it.</Text>
            <TouchableOpacity onPress={submitReview} disabled={isCreatingReview} activeOpacity={0.85}
              style={{ marginTop: 16, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 15, alignItems: "center" }}>
              {isCreatingReview ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Submit review</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
