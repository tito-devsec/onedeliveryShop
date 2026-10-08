import SafeScreen from "@/components/SafeScreen";
import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { formatMoney } from "@/lib/utils";

const { width } = Dimensions.get("window");
const H_PAD = 20;
const CARD_SIZE = (width - H_PAD * 2 - 12) / 2;
const SLIDE_W = width - H_PAD * 2;

const FALLBACK_ICONS: Record<string, { icon: any; color: string }> = {
  Electronics:  { icon: "hardware-chip-outline", color: "#3B82F6" },
  Fashion:      { icon: "shirt-outline",          color: "#EC4899" },
  Sports:       { icon: "fitness-outline",        color: "#22C55E" },
  Books:        { icon: "book-outline",           color: "#F59E0B" },
  Food:         { icon: "fast-food-outline",      color: "#EF4444" },
  Beauty:       { icon: "sparkles-outline",       color: "#A855F7" },
  Furniture:    { icon: "bed-outline",            color: "#14B8A6" },
  Toys:         { icon: "game-controller-outline",color: "#F97316" },
};
const DEFAULT_STYLE = { icon: "grid-outline", color: "#94A3B8" };

function parseImages(images: any): string[] {
  if (Array.isArray(images)) return images;
  if (typeof images === "string") { try { return JSON.parse(images || "[]"); } catch { return []; } }
  return [];
}

export default function HomeScreen() {
  const api = useApi();
  const { user } = useAuth();
  const [slide, setSlide] = useState(0);
  const slideRef = useRef<ScrollView>(null);

  const { data: catsData, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => { const { data } = await api.get("/products/categories"); return data; },
    staleTime: 5 * 60_000,
  });

  const { data: featData, isLoading: featLoading } = useQuery({
    queryKey: ["products-featured"],
    queryFn: async () => { const { data } = await api.get("/products?featured=1&limit=10"); return data; },
    refetchInterval: 60_000,
  });

  const { data: prodsData, isLoading: prodsLoading } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => { const { data } = await api.get("/products?limit=30"); return data; },
    staleTime: 60_000,
  });

  const categories  = catsData?.categories || [];
  const featured    = featData?.products   || [];
  const allProducts = prodsData?.products  || [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const onSlideScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (SLIDE_W + 14));
    if (i !== slide) setSlide(i);
  };

  return (
    <SafeScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 16, backgroundColor: "#0F172A" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                <Image source={require("../../assets/images/onedelivery-logo-tight.png")} style={{ width: 46, height: 46 }} contentFit="contain" />
              </View>
              <View>
                <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>One Delivery</Text>
                <Text style={{ color: "#94A3B8", fontSize: 12.5, marginTop: 2 }}>{greeting()}, {user?.name?.split(" ")[0] || "there"} 👋</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => router.push("/notifications")} style={{ backgroundColor: "#1E293B", borderRadius: 12, padding: 10 }}>
                <Ionicons name="notifications-outline" size={22} color="#F97316" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cart")} style={{ backgroundColor: "#1E293B", borderRadius: 12, padding: 10 }}>
                <Ionicons name="cart-outline" size={22} color="#F97316" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Search */}
          <TouchableOpacity onPress={() => router.push("/category/search")} activeOpacity={0.8}
            style={{ backgroundColor: "#1E293B", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: "#334155" }}>
            <Ionicons name="search" size={18} color="#64748B" />
            <Text style={{ color: "#64748B", fontSize: 14, marginLeft: 10, flex: 1 }}>Search products...</Text>
          </TouchableOpacity>
        </View>

        {/* Featured slider */}
        {featLoading ? (
          <View style={{ padding: 20 }}><ActivityIndicator color="#F97316" /></View>
        ) : featured.length > 0 ? (
          <View style={{ marginTop: 18, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: H_PAD, marginBottom: 12 }}>
              <Text style={{ color: "#F8FAFC", fontSize: 19, fontWeight: "800" }}>Featured Products</Text>
              <TouchableOpacity onPress={() => router.push("/category/all")}>
                <Text style={{ color: "#F97316", fontSize: 13, fontWeight: "600" }}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={slideRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={SLIDE_W + 14}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 14 }}
              onScroll={onSlideScroll}
              scrollEventThrottle={16}
            >
              {featured.map((p: any) => {
                const imgs = parseImages(p.images);
                return (
                  <TouchableOpacity key={p.id} onPress={() => router.push(`/product/${p.id}`)} activeOpacity={0.9}
                    style={{ width: SLIDE_W, height: 230, borderRadius: 22, overflow: "hidden", backgroundColor: "#1E293B" }}>
                    <Image source={imgs[0] ? { uri: imgs[0] } : require("../../assets/images/onedelivery-logo-tight.png")}
                      style={{ width: "100%", height: "100%", backgroundColor: "#334155" }} contentFit="cover" />
                    {/* gradient-ish overlay */}
                    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, backgroundColor: "#0F172A", opacity: 0.55 }} />
                    <View style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                      <View style={{ alignSelf: "flex-start", backgroundColor: "#F97316", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>⭐ FEATURED</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }} numberOfLines={1}>{p.name}</Text>
                          <Text style={{ color: "#F97316", fontSize: 18, fontWeight: "900", marginTop: 2 }}>{formatMoney(p.price)}</Text>
                        </View>
                        <View style={{ backgroundColor: "#2563EB", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 }}>
                          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Shop Now</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {/* dots */}
            {featured.length > 1 && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 }}>
                {featured.map((_: any, i: number) => (
                  <View key={i} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? "#F97316" : "#334155" }} />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Quick stat tiles (decorative parity with reference) */}
        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: H_PAD, marginTop: 16 }}>
          <View style={{ flex: 1, backgroundColor: "#1E293B", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#334155" }}>
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>New Arrivals</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "900" }}>{allProducts.length}</Text>
              <View style={{ backgroundColor: "#F9731620", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: "#F97316", fontSize: 10, fontWeight: "800" }}>HOT</Text>
              </View>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: "#1E293B", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#334155" }}>
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>Categories</Text>
            <Text style={{ color: "#22C55E", fontSize: 20, fontWeight: "900", marginTop: 4 }}>{categories.length}</Text>
          </View>
        </View>

        {/* Categories grid */}
        <View style={{ paddingHorizontal: H_PAD, marginTop: 24, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ color: "#F8FAFC", fontSize: 19, fontWeight: "800" }}>Shop by Category</Text>
            <TouchableOpacity onPress={() => router.push("/category/all")}>
              <Text style={{ color: "#F97316", fontSize: 13, fontWeight: "600" }}>See all</Text>
            </TouchableOpacity>
          </View>
          {catsLoading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 20 }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {categories.map((cat: any) => {
                const s = FALLBACK_ICONS[cat.name] || DEFAULT_STYLE;
                return (
                  <TouchableOpacity key={cat.id} onPress={() => router.push(`/category/${cat.id}`)} activeOpacity={0.85}
                    style={{ width: CARD_SIZE, height: 110, backgroundColor: "#1E293B", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#334155" }}>
                    {cat.image_url ? (
                      <>
                        <Image source={{ uri: cat.image_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, backgroundColor: "#0F172A", opacity: 0.6 }} />
                        <Text style={{ position: "absolute", left: 12, bottom: 10, color: "#fff", fontSize: 14, fontWeight: "800" }}>{cat.name}</Text>
                      </>
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 10 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: (cat.color || s.color) + "22", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                          <Ionicons name={(cat.icon || s.icon) as any} size={24} color={cat.color || s.color} />
                        </View>
                        <Text style={{ color: "#F8FAFC", fontSize: 13, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>{cat.name}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {categories.length === 0 && (
                <Text style={{ color: "#64748B", paddingVertical: 20 }}>No categories yet</Text>
              )}
            </View>
          )}
        </View>

        {/* All Products */}
        <View style={{ paddingHorizontal: H_PAD, marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ color: "#F8FAFC", fontSize: 19, fontWeight: "800" }}>All Products</Text>
          </View>
          {prodsLoading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 20 }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {allProducts.map((product: any) => {
                const imgs = parseImages(product.images);
                return (
                  <TouchableOpacity key={product.id} onPress={() => router.push(`/product/${product.id}`)} activeOpacity={0.85}
                    style={{ width: CARD_SIZE, backgroundColor: "#1E293B", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#334155" }}>
                    <Image source={imgs[0] ? { uri: imgs[0] } : require("../../assets/images/onedelivery-logo-tight.png")}
                      style={{ width: CARD_SIZE, height: CARD_SIZE, backgroundColor: "#334155" }} contentFit="cover" />
                    <View style={{ padding: 10 }}>
                      <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 13 }} numberOfLines={2}>{product.name}</Text>
                      <Text style={{ color: "#F97316", fontWeight: "800", fontSize: 14, marginTop: 4 }}>{formatMoney(product.price)}</Text>
                      {product.avg_rating > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <Text style={{ color: "#F59E0B", fontSize: 12 }}>★</Text>
                          <Text style={{ color: "#94A3B8", fontSize: 11 }}>{parseFloat(product.avg_rating).toFixed(1)} ({product.total_reviews})</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
