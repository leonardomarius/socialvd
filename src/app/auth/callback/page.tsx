// ✅ Server Component wrapper - exports les configs de route (pas de "use client")
import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";
import AuthCallbackFallback from "./AuthCallbackFallback";

// ✅ Force la page à être dynamique (pas de prerendering)
// Nécessaire car cette page dépend des paramètres de requête OAuth qui ne sont jamais connus au build time
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ Page principale (Server Component) : encapsule le Client Component dans Suspense (requis Next.js 16)
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackClient />
    </Suspense>
  );
}
