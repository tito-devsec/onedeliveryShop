import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { C } from "@/lib/theme";
import { formatMoney } from "@/lib/utils";

export function parseImages(images: any): string[] {
  if (Array.isArray(images)) return images;
  if (typeof images === "string") { try { return JSON.parse(images || "[]"); } catch { return []; } }
  return [];
}

// Flat product tile used by the shop grid, category pages and "Similar Products"
export default function ProductCard({ product, width, liked, onToggleLike }: {
  product: any; width: number; liked?: boolean; onToggleLike?: () => void;
}) {
  const img = parseImages(product.images)[0];
  const rating = Number(product.avg_rating) || 0;

  return (
    <TouchableOpacity onPress={() => router.push(`/product/${product.id}`)} activeOpacity={0.85}
      style={{ width, backgroundColor: C.card, borderRadius: 16, overflow: "hidden" }}>
      <View>
        <Image source={img ? { uri: img } : require("../assets/images/onedelivery-logo.png")}
          style={{ width, height: width, backgroundColor: C.well }} contentFit="cover" transition={150} />
        {onToggleLike && (
          <TouchableOpacity onPress={onToggleLike} hitSlop={8}
            style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFFE6", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={16} color={liked ? C.red : C.text} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ padding: 10 }}>
        {product.category_name ? <Text style={{ color: C.textMuted, fontSize: 11 }} numberOfLines={1}>{product.category_name}</Text> : null}
        <Text style={{ color: C.text, fontWeight: "600", fontSize: 13, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>{product.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ color: C.orange, fontWeight: "800", fontSize: 14 }}>{formatMoney(product.price)}</Text>
          {rating > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Ionicons name="star" size={11} color={C.star} />
              <Text style={{ color: C.textSecondary, fontSize: 11 }}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
