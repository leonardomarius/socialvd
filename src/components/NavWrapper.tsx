"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";

export default function NavWrapper() {
  const [showNavbar, setShowNavbar] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Pages où la navbar NE DOIT PAS apparaître
      const publicPages = ["/", "/login", "/signup"];

      const current = window.location.pathname;

      setShowNavbar(!publicPages.includes(current));
    }
  }, []);

  if (!showNavbar) return null;

  return <Navbar />;
}
