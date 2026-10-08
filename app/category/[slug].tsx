import ProductCard from "@/components/ProductCard";
import useWishlist from "@/hooks/useWishlist";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/api";
import { requireSignIn } from "@/lib/authGate";
import { C } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useDeferredValue } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const H_PAD = 16;
const GAP = 12;
const CARD = (width - H_PAD * 2 - GAP) / 2;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const api      = useApi();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const isSearch = slug === "search";
  const isAll    = slug === "all";

  const { data, isLoading } = useQuery({
    queryKey: ["products-cat", slug, deferredSearch],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (!isSearch && !isAll) q.set("category", slug);
      if (deferredSearch.length >= 2) q.set("search", deferredSearch);
      q.set("limit", "60");
      const { data } = await api.get(`/products?${q.toString()}`);
      return data;
    },
    enabled: !isSearch || deferredSearch.length >= 2,
  });

  // Public category list (the /admin/categories endpoint needs an admin login)
  const { data: catData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => { const { data } = await api.get("/products/categories"); return data; },
    enabled: !isSearch && !isAll,
    staleTime: 5 * 60_000,
  });

  const products = data?.products || [];
  const category = (catData?.categories || []).find((c: any) => c.id === slug);
  const title    = isSearch ? "Search" : isAll ? "All Products" : category?.name || "Products";
  const like     = (id: string) => (user ? toggleWishlist(id) : requireSignIn(`/category/${slug}`));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: H_PAD, backgroundColor: C.card }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={24} color={C.text} /></TouchableOpacity>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "700", flex: 1 }}>{title}</Text>
          {!!data?.total && <Text style={{ color: C.textMuted, fontSize: 13 }}>{data.total} items</Text>}
        </View>
        <View style={{ backgroundColor: C.bg, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
          <Ionicons name="search" size={18} color={C.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isSearch ? "Search products…" : `Search in ${title}…`}
            placeholderTextColor={C.textMuted}
            style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 12, paddingHorizontal: 10 }}
            autoFocus={isSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.navy} size="large" />
        </View>
      ) : isSearch && deferredSearch.length < 2 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="search-outline" size={56} color="#CDD1DA" />
          <Text style={{ color: C.textSecondary, marginTop: 14, textAlign: "center" }}>Type at least 2 characters to search</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="cube-outline" size={56} color="#CDD1DA" />
          <Text style={{ color: C.text, fontSize: 17, fontWeight: "700", marginTop: 14 }}>No products found</Text>
          {search ? <Text style={{ color: C.textSecondary, marginTop: 4 }}>Try a different search term</Text> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: H_PAD, paddingBottom: insets.bottom + 32 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} width={CARD} liked={isInWishlist(p.id)} onToggleLike={() => like(p.id)} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
