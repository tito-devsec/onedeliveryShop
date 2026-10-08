import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useDeferredValue } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney } from "@/lib/utils";

const { width } = Dimensions.get("window");
const CARD = (width - 48) / 2;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const api      = useApi();
  const insets   = useSafeAreaInsets();
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

  const { data: catData } = useQuery({
    queryKey: ["category-info", slug],
    queryFn: async () => {
      if (isSearch || isAll) return null;
      const { data } = await api.get("/admin/categories");
      return (data.categories || []).find((c: any) => c.id === slug) || null;
    },
    enabled: !isSearch && !isAll,
  });

  const products = data?.products || [];
  const title    = isSearch ? "Search" : isAll ? "All Products" : catData?.name || "Products";

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800", flex: 1 }}>{title}</Text>
        {data?.total && <Text style={{ color: "#64748B", fontSize: 13 }}>{data.total} items</Text>}
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <View style={{ backgroundColor: "#1E293B", borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#334155" }}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isSearch ? "Search products…" : `Search in ${title}…`}
            placeholderTextColor="#475569"
            style={{ flex: 1, color: "#F8FAFC", fontSize: 14, paddingVertical: 13, paddingHorizontal: 10 }}
            autoFocus={isSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : isSearch && deferredSearch.length < 2 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="search-outline" size={60} color="#334155" />
          <Text style={{ color: "#64748B", marginTop: 16, textAlign: "center" }}>Type at least 2 characters to search</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="cube-outline" size={60} color="#334155" />
          <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No products found</Text>
          {search && <Text style={{ color: "#64748B", marginTop: 4 }}>Try a different search term</Text>}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 4 }}>
            {products.map((p: any) => {
              const imgs = Array.isArray(p.images) ? p.images : (typeof p.images === "string" ? JSON.parse(p.images || "[]") : []);
              return (
                <TouchableOpacity key={p.id} onPress={() => router.push(`/product/${p.id}`)} activeOpacity={0.85}
                  style={{ width: CARD, backgroundColor: "#1E293B", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#334155" }}>
                  <Image
                    source={imgs[0] ? { uri: imgs[0] } : require("../../assets/images/onedelivery-logo.png")}
                    style={{ width: CARD, height: CARD, backgroundColor: "#334155" }} contentFit="cover" />
                  {p.is_featured && (
                    <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: "#F97316", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>⭐</Text>
                    </View>
                  )}
                  <View style={{ padding: 10 }}>
                    <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 13 }} numberOfLines={2}>{p.name}</Text>
                    <Text style={{ color: "#F97316", fontWeight: "800", fontSize: 14, marginTop: 4 }}>{formatMoney(p.price)}</Text>
                    {p.avg_rating > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
                        <Text style={{ color: "#F59E0B", fontSize: 11 }}>★</Text>
                        <Text style={{ color: "#94A3B8", fontSize: 11 }}>{parseFloat(p.avg_rating).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
