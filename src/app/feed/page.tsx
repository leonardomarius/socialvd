"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link"; // <-- AJOUT ICI

type Post = {
  id: string;
  content: string;
  game: string | null;
  author_pseudo: string | null;
  likes: number;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string; // <-- ASSURE QUE CETTE INFO EXISTE (normalement oui)
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

  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [newPost, setNewPost] = useState("");
  const [newGame, setNewGame] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // -----------------------------------------------------
  // Vérifier session
  // -----------------------------------------------------
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      router.push("/login");
      return;
    }
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    setPosts(postsData || []);

    const { data: commentsData } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true });

    setComments(commentsData || []);
  };

  // -----------------------------------------------------
  // Upload media
  // -----------------------------------------------------
  const uploadMedia = async (): Promise<{ url: string | null; type: string | null }> => {
    if (!mediaFile) return { url: null, type: null };

    const fileExt = mediaFile.name.split(".").pop();
    const filePath = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("posts-media")
      .upload(filePath, mediaFile);

    if (uploadError) return { url: null, type: null };

    const url = supabase.storage
      .from("posts-media")
      .getPublicUrl(filePath).data.publicUrl;

    let type = null;
    if (mediaFile.type.startsWith("image/")) type = "image";
    if (mediaFile.type.startsWith("video/")) type = "video";

    return { url, type };
  };

  // -----------------------------------------------------
  // Créer un post
  // -----------------------------------------------------
  const handleCreatePost = async () => {
    const userId = localStorage.getItem("user_id");
    const pseudo = localStorage.getItem("pseudo") || "Anonyme";

    if (!userId || !newPost.trim()) return;

    const { url, type } = await uploadMedia();

    await supabase.from("posts").insert({
      user_id: userId,
      content: newPost,
      game: newGame || null,
      author_pseudo: pseudo,
      media_url: url,
      media_type: type,
    });

    setNewPost("");
    setNewGame("");
    setMediaFile(null);

    loadAllData();
  };

  // -----------------------------------------------------
  // Commentaire
  // -----------------------------------------------------
  const handleAddComment = async (postId: string) => {
    const content = newComments[postId];
    if (!content) return;

    const pseudo =
      localStorage.getItem("pseudo") ||
      localStorage.getItem("user_pseudo") ||
      "Anonyme";

    await supabase.from("comments").insert({
      post_id: postId,
      content,
      author_pseudo: pseudo,
    });

    setNewComments((prev) => ({ ...prev, [postId]: "" }));
    loadAllData();
  };

  // -----------------------------------------------------
  // Like
  // -----------------------------------------------------
  const handleLike = async (postId: string) => {
    await supabase.rpc("toggle_like", { p_post_id: postId });
    loadAllData();
  };

  // -----------------------------------------------------
  // Render
  // -----------------------------------------------------
  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Fil d’actualité</h1>

      {/* FORMULAIRE */}
      <div
        style={{
          background: "#111",
          border: "1px solid #333",
          padding: "15px",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <h3>Créer un post</h3>

        <input
          type="text"
          placeholder="Jeu (facultatif)"
          value={newGame}
          onChange={(e) => setNewGame(e.target.value)}
          style={{ marginBottom: "10px", width: "100%" }}
        />

        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Écris quelque chose..."
          rows={3}
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
          style={{ marginBottom: "10px" }}
        />

        <button onClick={handleCreatePost}>Publier</button>
      </div>

      {/* POSTS */}
      {posts.map((post) => {
        const postComments = comments.filter((c) => c.post_id === post.id);

        return (
          <div
            key={post.id}
            style={{
              background: "#111",
              border: "1px solid #333",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            <p style={{ marginBottom: "5px", opacity: 0.8 }}>
              <strong>
                {/* 🔥 PSEUDO CLIQUABLE VERS /profile/[id] */}
                <Link
                  href={`/profile/${post.user_id}`}
                  className="hover:underline"
                >
                  {post.author_pseudo}
                </Link>
              </strong>

              {post.game && <> — <em>{post.game}</em></>}
            </p>

            <p style={{ marginBottom: "10px" }}>{post.content}</p>

            {post.media_type === "image" && (
              <img
                src={post.media_url!}
                alt="media"
                style={{
                  width: "100%",
                  borderRadius: "10px",
                  marginTop: "10px",
                }}
              />
            )}

            {post.media_type === "video" && (
              <video
                src={post.media_url!}
                controls
                style={{
                  width: "100%",
                  borderRadius: "10px",
                  marginTop: "10px",
                }}
              ></video>
            )}

            <button
              onClick={() => handleLike(post.id)}
              style={{ marginTop: "10px", marginBottom: "15px" }}
            >
              👍 {post.likes}
            </button>

            {/* COMMENTAIRES */}
            <div>
              <h4 style={{ marginBottom: "10px" }}>Commentaires</h4>

              {postComments.map((c) => (
                <p key={c.id} style={{ marginBottom: "5px" }}>
                  <strong>{c.author_pseudo} :</strong> {c.content}
                </p>
              ))}

              <input
                type="text"
                placeholder="Commenter..."
                value={newComments[post.id] || ""}
                onChange={(e) =>
                  setNewComments((prev) => ({
                    ...prev,
                    [post.id]: e.target.value,
                  }))
                }
                style={{ marginRight: "5px" }}
              />
              <button onClick={() => handleAddComment(post.id)}>Envoyer</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
