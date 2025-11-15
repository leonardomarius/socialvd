"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  content: string;
  game: string | null;
  created_at: string;
  likes: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const user_id = localStorage.getItem("user_id");
    if (!user_id) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("pseudo, email")
        .eq("id", user_id)
        .single();

      if (!userError && user) {
        setPseudo(user.pseudo);
        setEmail(user.email);
      }

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, content, game, created_at, likes")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (postsData) setPosts(postsData);
    };

    fetchData();
  }, [router]);

  return (
    <div className="max-w-xl mx-auto pt-10 pb-16">
      <h1 className="text-3xl font-bold mb-4">Mon profil</h1>

      <div className="border p-4 rounded-lg bg-white shadow-sm mb-6">
        <p className="text-lg font-semibold">
          {pseudo || "Utilisateur"}
        </p>
        <p className="text-sm text-gray-600">
          {email || "Email non disponible"}
        </p>
      </div>

      <h2 className="text-xl font-semibold mb-3">Mes posts</h2>
      <div className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="border p-3 rounded-lg bg-white shadow-sm"
          >
            {post.game && (
              <p className="text-xs text-gray-500 mb-1">
                Jeu : {post.game}
              </p>
            )}
            <p className="text-sm text-gray-500">
              {new Date(post.created_at).toLocaleString()}
            </p>
            <p className="mt-1">{post.content}</p>
            <p className="text-xs text-gray-500 mt-1">
              👍 {post.likes} j’aime
            </p>
          </div>
        ))}

        {posts.length === 0 && (
          <p className="text-gray-500 text-sm">
            Tu n’as pas encore publié de post.
          </p>
        )}
      </div>
    </div>
  );
}
