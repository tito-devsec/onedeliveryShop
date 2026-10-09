import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/api";
import { detectProvider, formatMoney } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import useCart from "@/hooks/useCart";

const MOBILE_PROVIDERS = [
  { label: "M-Pesa",       prefix: "07", color: "#00A859", prefixes: ["074","075","076"] },
  { label: "Airtel Money", prefix: "07", color: "#FF0000", prefixes: ["068","069","078"] },
  { label: "Mixx",         prefix: "07", color: "#0099CC", prefixes: ["065","067","071","077"] },
  { label: "HaloPesa",     prefix: "06", color: "#F7941D", prefixes: ["061","062"] },
];

export default function CheckoutScreen() {
  const api = useApi();
  const qc  = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();

  const [phone, setPhone]         = useState(user?.phone || "");
  const [fullName, setFullName]   = useState(user?.name || "");
  const [address, setAddress]     = useState("");
  const [city, setCity]           = useState("");
  const [notes, setNotes]         = useState("");
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

  // Same as the server: product prices already include VAT; delivery is paid separately later
  const grandTotal = total;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cartItems: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shippingAddress: { full_name: fullName, street_address: address, city, phone_number: phone },
        payerPhone: phone,
        notes,
      };
      const { data } = await api.post("/payment/checkout", payload);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      router.replace({
        pathname: "/order-confirmed",
        params: { orderId: data.orderId, total: String(data.total) },
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err.message || "Checkout failed. Please try again.";
      Alert.alert("Checkout Failed", msg);
    },
  });

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    const prov = detectProvider(val);
    setDetectedProvider(prov);
  };

  const handleCheckout = () => {
    if (!phone.trim()) { Alert.alert("Required", "Enter your mobile money phone number."); return; }
    if (!fullName.trim()) { Alert.alert("Required", "Enter your full name."); return; }
    if (!address.trim()) { Alert.alert("Required", "Enter your delivery address."); return; }
    if (!city.trim()) { Alert.alert("Required", "Enter your city."); return; }
    if (items.length === 0) { Alert.alert("Empty cart", "Your cart is empty."); return; }
    checkoutMutation.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#1B2036" />
        </TouchableOpacity>
        <Text style={{ color: "#1B2036", fontSize: 20, fontWeight: "800" }}>Checkout</Text>
      </View>

      <View style={{ flex: 1 }}>
        {/* bottomOffset keeps the focused field clear of the Pay bar riding on the keyboard */}
        <KeyboardAwareScrollView bottomOffset={110} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* Order summary */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Order Summary</Text>
            {items.map((item) => (
              <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ color: "#4A5163", fontSize: 13, flex: 1, marginRight: 8 }} numberOfLines={1}>{item.name} × {item.quantity}</Text>
                <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 13 }}>{formatMoney(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: "#E6E8EE", marginTop: 12, paddingTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#1B2036", fontSize: 16, fontWeight: "800" }}>Total</Text>
                <Text style={{ color: "#EC7C2C", fontSize: 16, fontWeight: "800" }}>{formatMoney(grandTotal)}</Text>
              </View>
              <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 6 }}>Prices include VAT. Delivery is paid separately when you request it.</Text>
            </View>
          </View>

          {/* Delivery info */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Delivery Information</Text>
            {[
              { label: "Full Name", value: fullName, onChange: setFullName, placeholder: "Your full name", keyboard: "default" as const },
              { label: "Delivery Address", value: address, onChange: setAddress, placeholder: "Street address", keyboard: "default" as const },
              { label: "City", value: city, onChange: setCity, placeholder: "e.g. Dar es Salaam", keyboard: "default" as const },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={s.inputLabel}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.onChange} placeholder={f.placeholder} placeholderTextColor="#A0A6B4" keyboardType={f.keyboard}
                  style={s.textInput} />
              </View>
            ))}
            <View style={{ marginBottom: 8 }}>
              <Text style={s.inputLabel}>Order Notes (optional)</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Any special instructions..." placeholderTextColor="#A0A6B4" multiline
                style={[s.textInput, { height: 72, textAlignVertical: "top" }]} />
            </View>
          </View>

          {/* Payment */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Mobile Money Payment</Text>
            <Text style={{ color: "#8A90A0", fontSize: 13, marginBottom: 14 }}>Enter the number you'll pay from. You'll get a payment prompt on your phone.</Text>
            <View style={{ marginBottom: 8 }}>
              <Text style={s.inputLabel}>Phone Number</Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F4F5F8", borderWidth: 1, borderColor: "#E6E8EE", borderRadius: 13, paddingHorizontal: 14 }}>
                <Text style={{ color: "#6B7280", fontSize: 14, marginRight: 8 }}>🇹🇿</Text>
                <TextInput value={phone} onChangeText={handlePhoneChange} placeholder="0712 345 678" placeholderTextColor="#A0A6B4" keyboardType="phone-pad"
                  style={{ flex: 1, color: "#1B2036", fontSize: 15, paddingVertical: 14 }} />
              </View>
              {detectedProvider && (
                <Text style={{ color: "#16A34A", fontSize: 12, marginTop: 6 }}>✓ Detected: {detectedProvider}</Text>
              )}
            </View>

            {/* Supported providers */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {MOBILE_PROVIDERS.map((p) => (
                <View key={p.label} style={{ backgroundColor: p.color + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: p.color + "40" }}>
                  <Text style={{ color: p.color, fontSize: 11, fontWeight: "700" }}>{p.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </KeyboardAwareScrollView>

        {/* CTA — rides on top of the keyboard while typing */}
        <KeyboardStickyView offset={{ opened: insets.bottom }} style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <View style={{ padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: "#F4F5F8", borderTopWidth: 1, borderTopColor: "#FFFFFF" }}>
            <TouchableOpacity onPress={handleCheckout} disabled={checkoutMutation.isPending}
              style={{ backgroundColor: "#2E3A74", borderRadius: 16, paddingVertical: 17, alignItems: "center", opacity: checkoutMutation.isPending ? 0.7 : 1, flexDirection: "row", justifyContent: "center", gap: 10 }}>
              {checkoutMutation.isPending ? (
                <><ActivityIndicator color="#fff" /><Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Processing…</Text></>
              ) : (
                <><Ionicons name="phone-portrait" size={20} color="#fff" /><Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Pay {formatMoney(grandTotal)}</Text></>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardStickyView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE" },
  sectionLabel: { color: "#1B2036", fontSize: 16, fontWeight: "800", marginBottom: 14 },
  inputLabel: { color: "#6B7280", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  textInput: { backgroundColor: "#F4F5F8", borderWidth: 1, borderColor: "#E6E8EE", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, color: "#1B2036", fontSize: 14 },
});
