import { useAuth } from "@/context/AuthContext";
import GuestPrompt from "@/components/GuestPrompt";
import SafeScreen from "@/components/SafeScreen";
import useCart from "@/hooks/useCart";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { formatMoney } from "@/lib/utils";

function CartScreen() {
  const { items, total, cartItemCount, isLoading, updateQuantity, removeFromCart, clearCart } = useCart();

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearCart({}) },
    ]);
  };

  // Same as the server: product prices already include VAT; delivery is paid separately later
  const grandTotal = total;

  return (
    <SafeScreen>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#1B2036", fontSize: 22, fontWeight: "800" }}>Cart ({cartItemCount})</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 14 }}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#EC7C2C" size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="cart-outline" size={48} color="#E6E8EE" />
          </View>
          <Text style={{ color: "#1B2036", fontSize: 22, fontWeight: "800", marginBottom: 8 }}>Your cart is empty</Text>
          <Text style={{ color: "#8A90A0", textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
            Browse products and add items to your cart to get started.
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")}
            style={{ backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const imgs = Array.isArray(item.images) ? item.images : (typeof item.images === "string" ? JSON.parse(item.images || "[]") : []);
              return (
                <View key={item.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: "row", gap: 14, borderWidth: 1, borderColor: "#E6E8EE" }}>
                  <Image
                    source={imgs[0] ? { uri: imgs[0] } : require("../../assets/images/onedelivery-logo.png")}
                    style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#E6E8EE" }}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 14 }} numberOfLines={2}>{item.name}</Text>
                    {item.seller_name && (
                      <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 2 }}>by {item.seller_name}</Text>
                    )}
                    <Text style={{ color: "#EC7C2C", fontWeight: "800", fontSize: 15, marginTop: 6 }}>{formatMoney(item.price)}</Text>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                      {/* Quantity control */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F4F5F8", borderRadius: 12, padding: 4 }}>
                        <TouchableOpacity
                          onPress={() => item.quantity <= 1 ? removeFromCart(item.id) : updateQuantity({ itemId: item.id, quantity: item.quantity - 1 })}
                          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#E6E8EE", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={item.quantity <= 1 ? "trash-outline" : "remove"} size={16} color={item.quantity <= 1 ? "#DC2626" : "#1B2036"} />
                        </TouchableOpacity>
                        <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 16, minWidth: 28, textAlign: "center" }}>{item.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => item.quantity < item.stock && updateQuantity({ itemId: item.id, quantity: item.quantity + 1 })}
                          disabled={item.quantity >= item.stock}
                          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: item.quantity >= item.stock ? "#FFFFFF" : "#EC7C2C", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="add" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      {/* Item total */}
                      <Text style={{ color: "#EC7C2C", fontWeight: "800", fontSize: 14 }}>{formatMoney(item.price * item.quantity)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Summary + checkout */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#F4F5F8", padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: "#FFFFFF", gap: 10 }}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#1B2036", fontSize: 16, fontWeight: "800" }}>Total</Text>
                <Text style={{ color: "#EC7C2C", fontSize: 16, fontWeight: "900" }}>{formatMoney(grandTotal)}</Text>
              </View>
              <Text style={{ color: "#8A90A0", fontSize: 12 }}>Prices include VAT. Delivery is paid separately when you request it.</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/checkout")}
              style={{ backgroundColor: "#2E3A74", borderRadius: 16, paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeScreen>
  );
}

// Guests can browse the shop; this tab needs an account
export default function CartTab() {
  const { user } = useAuth();
  if (!user) return (
    <SafeScreen>
      <GuestPrompt icon="cart-outline" title="Your cart is waiting" message="Sign in to add items to your cart, check out and track your orders." />
    </SafeScreen>
  );
  return <CartScreen />;
}
