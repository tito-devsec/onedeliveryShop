import SafeScreen from "@/components/SafeScreen";
import useCart from "@/hooks/useCart";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { formatMoney } from "@/lib/utils";

export default function CartScreen() {
  const { items, total, cartItemCount, isLoading, updateQuantity, removeFromCart, clearCart } = useCart();

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearCart({}) },
    ]);
  };

  const shippingCost = items.length > 0 ? 2000 : 0;
  const grandTotal   = total + shippingCost;

  return (
    <SafeScreen>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "800" }}>Cart ({cartItemCount})</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="cart-outline" size={48} color="#334155" />
          </View>
          <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "800", marginBottom: 8 }}>Your cart is empty</Text>
          <Text style={{ color: "#64748B", textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
            Browse products and add items to your cart to get started.
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")}
            style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const imgs = Array.isArray(item.images) ? item.images : (typeof item.images === "string" ? JSON.parse(item.images || "[]") : []);
              return (
                <View key={item.id} style={{ backgroundColor: "#1E293B", borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: "row", gap: 14, borderWidth: 1, borderColor: "#334155" }}>
                  <Image
                    source={imgs[0] ? { uri: imgs[0] } : require("../../assets/images/onedelivery-logo.png")}
                    style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#334155" }}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 14 }} numberOfLines={2}>{item.name}</Text>
                    {item.seller_name && (
                      <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>by {item.seller_name}</Text>
                    )}
                    <Text style={{ color: "#F97316", fontWeight: "800", fontSize: 15, marginTop: 6 }}>{formatMoney(item.price)}</Text>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                      {/* Quantity control */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0F172A", borderRadius: 12, padding: 4 }}>
                        <TouchableOpacity
                          onPress={() => item.quantity <= 1 ? removeFromCart(item.id) : updateQuantity({ itemId: item.id, quantity: item.quantity - 1 })}
                          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={item.quantity <= 1 ? "trash-outline" : "remove"} size={16} color={item.quantity <= 1 ? "#EF4444" : "#F8FAFC"} />
                        </TouchableOpacity>
                        <Text style={{ color: "#F8FAFC", fontWeight: "800", fontSize: 16, minWidth: 28, textAlign: "center" }}>{item.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => item.quantity < item.stock && updateQuantity({ itemId: item.id, quantity: item.quantity + 1 })}
                          disabled={item.quantity >= item.stock}
                          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: item.quantity >= item.stock ? "#1E293B" : "#F97316", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="add" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      {/* Item total */}
                      <Text style={{ color: "#F97316", fontWeight: "800", fontSize: 14 }}>{formatMoney(item.price * item.quantity)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Summary + checkout */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#0F172A", padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: "#1E293B", gap: 10 }}>
            <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#94A3B8", fontSize: 13 }}>Subtotal</Text>
                <Text style={{ color: "#F8FAFC", fontSize: 13, fontWeight: "600" }}>{formatMoney(total)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#94A3B8", fontSize: 13 }}>Shipping</Text>
                <Text style={{ color: "#F8FAFC", fontSize: 13, fontWeight: "600" }}>{formatMoney(shippingCost)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: "#334155" }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "800" }}>Total</Text>
                <Text style={{ color: "#F97316", fontSize: 16, fontWeight: "900" }}>{formatMoney(grandTotal)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push("/checkout")}
              style={{ backgroundColor: "#F97316", borderRadius: 16, paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeScreen>
  );
}
