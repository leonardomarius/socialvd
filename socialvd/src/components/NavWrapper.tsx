"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavWrapper() {
  const pathname = usePathname(); // ⭐ Detects URL changes
  const [showNavbar, setShowNavbar] = useState(false);

  useEffect(() => {
    // Pages where the navbar MUST NOT appear
    const publicPages = ["/", "/login", "/signup"];

    setShowNavbar(!publicPages.includes(pathname));
  }, [pathname]); // ⭐ Updates as soon as the URL changes

  if (!showNavbar) return null;

  return <Navbar />;
}
