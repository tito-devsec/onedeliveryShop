import { router } from "expo-router";

// Guests can browse freely; buying, ordering, reviewing etc. send them here first.
let returnTo: string | null = null;

/** Opens sign-in (or sign-up) for a guest, remembering the screen to come back to. */
export function requireSignIn(from?: string, screen: "login" | "register" = "login") {
  returnTo = from ?? null;
  router.push(screen === "login" ? "/(auth)/login" : "/(auth)/register");
}

/** After a successful sign-in/sign-up: return to where the guest was (or the shop). */
export function finishSignIn() {
  const to = returnTo;
  returnTo = null;
  router.dismissTo((to ?? "/(tabs)") as any);
}

/** Leaves the auth screens without signing in. */
export function cancelSignIn() {
  returnTo = null;
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}
