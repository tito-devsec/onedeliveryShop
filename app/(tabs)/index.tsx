import SafeScreen from "@/components/SafeScreen";
import ProductCard, { parseImages } from "@/components/ProductCard";
import useWishlist from "@/hooks/useWishlist";
import { useApi } from "@/lib/api";
import { requireSignIn } from "@/lib/authGate";
import { C } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { formatMoney } from "@/lib/utils";

const { width } = Dimensions.get("window");
const H_PAD = 16;
const GAP = 12;
const CARD_SIZE = (width - H_PAD * 2 - GAP) / 2;
const SLIDE_W = width - H_PAD * 2;

const FALLBACK_ICONS: Record<string, { icon: any; color: string }> = {
  Electronics:  { icon: "hardware-chip-outline", color: "#2563EB" },
  Fashion:      { icon: "shirt-outline",          color: "#DB2777" },
  Sports:       { icon: "fitness-outline",        color: "#16A34A" },
  Books:        { icon: "book-outline",           color: "#D97706" },
  Food:         { icon: "fast-food-outline",      color: "#DC2626" },
  Beauty:       { icon: "sparkles-outline",       color: "#9333EA" },
  Furniture:    { icon: "bed-outline",            color: "#0D9488" },
  Toys:         { icon: "game-controller-outline",color: "#EC7C2C" },
};
const DEFAULT_STYLE = { icon: "grid-outline", color: C.textSecondary };

function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: H_PAD, marginBottom: 12 }}>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onPress} hitSlop={8}>
          <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: "500" }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const api = useApi();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [slide, setSlide] = useState(0);

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
    const i = Math.round(e.nativeEvent.contentOffset.x / (SLIDE_W + GAP));
    if (i !== slide) setSlide(i);
  };

  const like = (id: string) => (user ? toggleWishlist(id) : requireSignIn());

  return (
    <SafeScreen headerColor={C.card}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 16, backgroundColor: C.card }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Image source={require("../../assets/images/onedelivery-logo-wide.png")} style={{ width: 108, height: 108 / 1.844 }} contentFit="contain" />
              <Text style={{ color: C.textSecondary, fontSize: 13, marginTop: 4 }}>{greeting()}, {user?.name?.split(" ")[0] || "welcome"} 👋</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => (user ? router.push("/notifications") : requireSignIn("/notifications"))}
                style={{ backgroundColor: C.bg, borderRadius: 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="notifications-outline" size={21} color={C.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cart")}
                style={{ backgroundColor: C.bg, borderRadius: 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="bag-handle-outline" size={21} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>
          {/* Search */}
          <TouchableOpacity onPress={() => router.push("/category/search")} activeOpacity={0.8}
            style={{ backgroundColor: C.bg, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14 }}>
            <Ionicons name="search" size={18} color={C.textMuted} />
            <Text style={{ color: C.textMuted, fontSize: 14, marginLeft: 10, flex: 1 }}>Search products…</Text>
            <Ionicons name="options-outline" size={18} color={C.navy} />
          </TouchableOpacity>
        </View>

        {/* Featured slider */}
        {featLoading ? (
          <View style={{ padding: 20 }}><ActivityIndicator color={C.navy} /></View>
        ) : featured.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              snapToInterval={SLIDE_W + GAP} decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: H_PAD, gap: GAP }}
              onScroll={onSlideScroll} scrollEventThrottle={16}>
              {featured.map((p: any) => {
                const img = parseImages(p.images)[0];
                return (
                  <TouchableOpacity key={p.id} onPress={() => router.push(`/product/${p.id}`)} activeOpacity={0.9}
                    style={{ width: SLIDE_W, height: 190, borderRadius: 20, overflow: "hidden", backgroundColor: C.navy }}>
                    <Image source={img ? { uri: img } : require("../../assets/images/onedelivery-logo-tight.png")}
                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SLIDE_W * 0.5 }} contentFit="cover" />
                    <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: SLIDE_W * 0.58, backgroundColor: C.navy, padding: 18, justifyContent: "center" }}>
                      <View style={{ alignSelf: "flex-start", backgroundColor: C.orange, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>FEATURED</Text>
                      </View>
                      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 23 }} numberOfLines={2}>{p.name}</Text>
                      <Text style={{ color: "#FFD3B0", fontSize: 15, fontWeight: "700", marginTop: 6 }}>{formatMoney(p.price)}</Text>
                      <View style={{ alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 }}>
                        <Text style={{ color: C.navy, fontWeight: "700", fontSize: 12 }}>Shop now</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {featured.length > 1 && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 }}>
                {featured.map((_: any, i: number) => (
                  <View key={i} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? C.navy : "#CDD1DA" }} />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Categories */}
        <View style={{ marginTop: 22 }}>
          <SectionTitle title="Categories" action="See all" onPress={() => router.push("/category/all")} />
          {catsLoading ? (
            <ActivityIndicator color={C.navy} style={{ marginTop: 12 }} />
          ) : categories.length === 0 ? (
            <Text style={{ color: C.textMuted, paddingHorizontal: H_PAD }}>No categories yet</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: GAP }}>
              {categories.map((cat: any) => {
                const s = FALLBACK_ICONS[cat.name] || DEFAULT_STYLE;
                return (
                  <TouchableOpacity key={cat.id} onPress={() => router.push(`/category/${cat.id}`)} activeOpacity={0.85}
                    style={{ width: 104, backgroundColor: C.card, borderRadius: 16, overflow: "hidden" }}>
                    {cat.image_url ? (
                      <Image source={{ uri: cat.image_url }} style={{ width: 104, height: 84, backgroundColor: C.well }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 104, height: 84, alignItems: "center", justifyContent: "center", backgroundColor: (cat.color || s.color) + "14" }}>
                        <Ionicons name={(cat.icon || s.icon) as any} size={30} color={cat.color || s.color} />
                      </View>
                    )}
                    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: "600", textAlign: "center", paddingVertical: 9, paddingHorizontal: 6 }} numberOfLines={1}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* All products */}
        <View style={{ marginTop: 24 }}>
          <SectionTitle title="Popular products" action={`${allProducts.length} items`} onPress={() => router.push("/category/all")} />
          {prodsLoading ? (
            <ActivityIndicator color={C.navy} style={{ marginTop: 12 }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: H_PAD }}>
              {allProducts.map((product: any) => (
                <ProductCard key={product.id} product={product} width={CARD_SIZE}
                  liked={isInWishlist(product.id)} onToggleLike={() => like(product.id)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
