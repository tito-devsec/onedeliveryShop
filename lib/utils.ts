export const capitalizeFirstLetter = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

export const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-TZ", { month: "short", day: "numeric", year: "numeric" });
};

export const formatMoney = (amount: number | string) =>
  "TZS " + parseFloat(String(amount || 0)).toLocaleString("en-TZ");

export const timeAgo = (dateStr: string) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const getStatusColor = (status: string) => {
  switch ((status || "").toLowerCase()) {
    case "delivered":   return "#16A34A";
    case "shipped":
    case "on_the_way":  return "#2563EB";
    case "processing":
    case "accepted":    return "#7C3AED";
    case "pending":
    case "searching":   return "#E0950B";
    case "cancelled":
    case "no_driver":   return "#DC2626";
    default:            return "#6B7280";
  }
};

export const vehicleEmoji = (type: string) =>
  ({ bodaboda: "🏍️", bajaj: "🛺", pickup: "🚛", toyo: "🚙" }[type] || "🚗");

export const detectProvider = (phone: string) => {
  const p = phone.replace(/[\s\-+]/g, "");
  const local = p.startsWith("255") ? "0" + p.slice(3) : p;
  const prefix = local.slice(0, 3);
  if (["076","077"].includes(prefix)) return "M-Pesa";
  if (["078","079"].includes(prefix)) return "Airtel Money";
  if (["071","072","073"].includes(prefix)) return "Mixx by Yas";
  if (["062","061"].includes(prefix)) return "HaloPesa";
  return null;
};
