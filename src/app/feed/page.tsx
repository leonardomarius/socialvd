"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/utils/supabaseClient";
import AuthGuard from "@/components/AuthGuard";
const supabase = supabaseBrowser();

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

function FeedContent() {
  const [content, setContent] = useState("");
  const [game, setGame] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComments, setNewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    // l'utilisateur est déjà garanti comme connecté par AuthGuard
    fetchPosts();
    fetchComments();
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPosts(data);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (data) setComments(data);
  };

  const createPost = async () => {
    if (!content.trim()) return;

    const user_id = localStorage.getItem("user_id");
    const author_pseudo =
      localStorage.getItem("user_pseudo") || "Anonyme";

    if (!user_id) {
      alert("Utilisateur non connecté.");
      return;
    }

    await supabase.from("posts").insert([
      {
        content,
        user_id,
        author_pseudo,
        game: game || null,
        likes: 0,
      },
    ]);

    setContent("");
    setGame("");
    fetchPosts();
  };

  const likePost = async (postId: string, currentLikes: number) => {
    await supabase
      .from("posts")
      .update({ likes: currentLikes + 1 })
      .eq("id", postId);

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes: p.likes + 1 } : p
      )
    );
  };

  const handleCommentChange = (postId: string, value: string) => {
    setNewComments((prev) => ({
      ...prev,
      [postId]: value,
    }));
  };

  const submitComment = async (postId: string) => {
    const text = newComments[postId]?.trim();
    if (!text) return;

    const author_pseudo =
      localStorage.getItem("user_pseudo") || "Anonyme";

    await supabase.from("comments").insert([
      {
        post_id: postId,
        content: text,
        author_pseudo,
      },
    ]);

    setNewComments((prev) => ({ ...prev, [postId]: "" }));
    fetchComments();
  };

  const commentsByPost: Record<string, Comment[]> = {};
  comments.forEach((c) => {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  });

  return (
    <div className="max-w-xl mx-auto pt-10 pb-16">
      <h1 className="text-3xl font-bold mb-8">Fille d’actualité</h1>

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
                  <p className="text-xs text-gray-500">
                    Jeu : {post.game}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </div>

            <p className="text-lg mb-3">{post.content}</p>

            <button
              className="text-sm text-blue-600 mb-3"
              onClick={() => likePost(post.id, post.likes)}
            >
              👍 J’aime ({post.likes})
            </button>

            <div className="mt-2 border-t pt-3">
              <p className="text-sm font-semibold mb-2">
                Commentaires
              </p>

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

export default function FeedPage() {
  return (
    <AuthGuard>
   <div className="max-w-xl mx-auto pt-10 pb-16">
      <FeedContent />
   </div>
</AuthGuard>

  );
}
