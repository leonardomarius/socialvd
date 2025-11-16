"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_pseudo");
    router.push("/login");
  };

  const loggedIn = typeof window !== "undefined" && localStorage.getItem("user_id");

  return (
    <nav className="w-full fixed top-0 left-0 bg-white shadow-md z-50 p-4 flex justify-between items-center">
      <Link href="/feed" className="font-semibold text-lg">
        SocialVD
      </Link>

      <div className="flex gap-4">
        {loggedIn && (
          <>
            <Link href="/profile">Profil</Link>
            <button onClick={logout} className="text-red-500">
              Déconnexion
            </button>
          </>
        )}

        {!loggedIn && (
          <>
            <Link href="/login">Connexion</Link>
            <Link href="/signup">Créer un compte</Link>
          </>
        )}
      </div>
    </nav>
  );
}
