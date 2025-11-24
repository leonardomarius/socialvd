"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavWrapper() {
  const pathname = usePathname(); // ⭐ Détecte les changements d’URL
  const [showNavbar, setShowNavbar] = useState(false);

  useEffect(() => {
    // Pages où la navbar NE DOIT PAS apparaître
    const publicPages = ["/", "/login", "/signup"];

    setShowNavbar(!publicPages.includes(pathname));
  }, [pathname]); // ⭐ Mise à jour dès que l’URL change

  if (!showNavbar) return null;

  return <Navbar />;
}
