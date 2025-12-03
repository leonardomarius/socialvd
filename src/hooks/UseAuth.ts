"use client";

import { useEffect, useState } from "react";

export default function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    setUserId(id);
    setLoading(false);
  }, []);

  return { userId, loading };
}
