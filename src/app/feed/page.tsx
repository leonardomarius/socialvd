"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  content: string;
  user_id: string;
  author_pseudo: string | null;
  game: string | null;
  likes: number;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  author_pseudo: string;
  content: string;
  created_at: string;
};

export default function FeedPage() {
  const router = useRouter();

  const [content, setContent] = useState("");
  const [game, setGame] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComments, setNewComments] = useState<Record<string, string>>({});

  // ----- Vérifier si l'utilisateur est connecté + charger les données -----
  useEffect(() => {
    const user_id = localStorage.getItem("user_id");
    if (!user_id) {
      router.push("/login");
      return;
    }

    fetchPosts();
    fetchComments();
  }, [router]);

  // ----- Récupérer les posts -----
  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

  // ----- Récupérer les commentaires -----
  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setComments(data);
    }
  };

  // ----- Créer un post -----
  const createPost = async () => {
    if (!content.trim()) return;

    const user_id = localStorage.getItem("user_id");
    const author_pseudo = localStorage.getItem("user_pseudo") || "Anonyme";

    if (!user_id) {
      alert("Utilisateur non connecté.");
      return;
    }

    const { error } = await supabase.from("posts").insert([
      {
        content,
        user_id,
        author_pseudo,
        game: game || null,
        likes: 0,
      },
    ]);

    if (error) {
      console.error("INSERT ERROR =", error);
      alert("Erreur lors de la publication du post.");
      return;
    }

    setContent("");
    setGame("");
    fetchPosts();
  };

  // ----- Liker un post (simple increment) -----
  const likePost = async (postId: string, currentLikes: number) => {
    const { error } = await supabase
      .from("posts")
      .update({ likes: currentLikes + 1 })
      .eq("id", postId);

    if (!error) {
      // Met à jour localement
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: p.likes + 1 } : p
        )
      );
    }
  };

  // ----- Saisir un commentaire -----
  const handleCommentChange = (postId: string, value: string) => {
    setNewComments((prev) => ({
      ...prev,
      [postId]: value,
    }));
  };

  // ----- Envoyer un commentaire -----
  const submitComment = async (postId: string) => {
    const content = newComments[postId]?.trim();
    if (!content) return;

    const author_pseudo = localStorage.getItem("user_pseudo") || "Anonyme";

    const { error } = await supabase.from("comments").insert([
      {
        post_id: postId,
        content,
        author_pseudo,
      },
    ]);

    if (!error) {
      setNewComments((prev) => ({ ...prev, [postId]: "" }));
      fetchComments();
    }
  };

  // ----- Regrouper les commentaires par post -----
  const commentsByPost: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  }

  return (
    <div className="max-w-xl mx-auto pt-10 pb-16">
      <h1 className="text-3xl font-bold mb-8">Fil d’actualité</h1>

      {/* FORMULAIRE DE POST */}
      <div className="mb-6 border p-4 rounded-lg bg-white shadow-sm">
        <textarea
          className="w-full p-3 border rounded-md mb-3"
          placeholder="Quoi de neuf ?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input
          className="w-full p-2 border rounded-md mb-3"
          placeholder="Jeu (optionnel)"
          value={game}
          onChange={(e) => setGame(e.target.value)}
        />
        <button
          onClick={createPost}
          className="w-full bg-black text-white py-2 rounded-md font-semibold"
        >
          Publier
        </button>
      </div>

      {/* LISTE DES POSTS */}
      <div className="space-y-6">
        {posts.map((post) => (
          <div
            key={post.id}
            className="border p-4 rounded-lg bg-white shadow-sm"
          >
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="font-semibold">
                  {post.author_pseudo || "Utilisateur"}
                </p>
                {post.game && (
                  <p className="text-xs text-gray-500">Jeu : {post.game}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </div>

            <p className="text-lg mb-3">{post.content}</p>

            {/* Zone like */}
            <button
              className="text-sm text-blue-600 mb-3"
              onClick={() => likePost(post.id, post.likes)}
            >
              👍 J’aime ({post.likes})
            </button>

            {/* Commentaires */}
            <div className="mt-2 border-t pt-3">
              <p className="text-sm font-semibold mb-2">Commentaires</p>

              <div className="space-y-2 mb-3">
                {(commentsByPost[post.id] || []).map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="font-semibold">
                      {c.author_pseudo}
                    </span>{" "}
                    : {c.content}
                  </div>
                ))}
                {(!commentsByPost[post.id] ||
                  commentsByPost[post.id].length === 0) && (
                  <p className="text-xs text-gray-400">
                    Aucun commentaire pour l’instant.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-md p-2 text-sm"
                  placeholder="Ajouter un commentaire…"
                  value={newComments[post.id] || ""}
                  onChange={(e) =>
                    handleCommentChange(post.id, e.target.value)
                  }
                />
                <button
                  className="px-3 py-2 bg-black text-white rounded-md text-sm"
                  onClick={() => submitComment(post.id)}
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        ))}

        {posts.length === 0 && (
          <p className="text-center text-gray-500">
            Aucun post pour l’instant. Lance le mouvement !
          </p>
        )}
      </div>
    </div>
  );
}
