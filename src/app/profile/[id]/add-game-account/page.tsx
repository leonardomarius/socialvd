"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddGameAccountPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Stats Hub - the only way to connect game accounts
    router.replace("/profile/stats");
  }, [router]);

  return (
    <div
      style={{
        maxWidth: 450,
        margin: "40px auto",
        padding: 20,
        borderRadius: 10,
        border: "1px solid #222",
        background: "#050505",
        color: "white",
        textAlign: "center",
      }}
    >
      <p>Redirecting to Stats Hub...</p>
    </div>
  );
}
