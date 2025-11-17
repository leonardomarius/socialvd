// src/components/NavWrapper.tsx
"use client";

import Navbar from "@/components/Navbar";

export default function NavWrapper() {
  // On ne vérifie plus la session ici.
  // L'authentification est gérée via localStorage dans Login/Signup.
  // Le Navbar s'affiche simplement.
  return <Navbar />;
}
