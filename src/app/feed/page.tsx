"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Post = {
  id: string;
  content: string;
  game: string | null;
  author_pseudo: string | null;
  likes: number;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  avatar_url?: string | null;
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

  const [myId, setMyId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [newPost, setNewPost] = useState("");
  const [newGame, setNewGame] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // -----------------------------------------------------
  // Vérifier session via Supabase
  // -----------------------------------------------------
  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setMyId(data.user.id);

      // Récup du pseudo dans profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("pseudo")
        .eq("id", data.user.id)
        .single();

      setPseudo(profile?.pseudo || "Utilisateur");
      loadAllData();
    };

    loadSession();
  }, []);

  // -----------------------------------------------------
  // Charger posts + commentaires
  // -----------------------------------------------------
  const loadAllData = async () => {
    // 1️⃣ Charger les posts
    const { data: postsData, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    // 2️⃣ Charger les avatars depuis profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, avatar_url");

    const avatarMap: Record<string, string | null> = {};
    profiles?.forEach((p) => {
      avatarMap[p.id] = p.avatar_url;
    });

    // 3️⃣ Fusion posts + avatars
    const postsFormatted =
      postsData?.map((p) => ({
        ...p,
        avatar_url: avatarMap[p.user_id] || null,
      })) || [];

    setPosts(postsFormatted);

    // 4️⃣ Charger commentaires
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
    if (!myId || !newPost.trim()) return;

    const { url, type } = await uploadMedia();

    await supabase.from("posts").insert({
      user_id: myId,
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

    await supabase.from("comments").insert({
      post_id: postId,
      content,
      author_pseudo: pseudo,
    });

    setNewComments((prev) => ({ ...prev, [postId]: "" }));
    loadAllData();
  };

  // -----------------------------------------------------
  // Like (via RPC toggle_like)
  // -----------------------------------------------------
  const handleLike = async (postId: string) => {
    await supabase.rpc("toggle_like", { p_post_id: postId });
    loadAllData();
  };

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Fil d’actualité</h1>

      {/* FORMULAIRE POST */}
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
            {/* --- AVATAR + PSEUDO --- */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Link href={`/profile/${post.user_id}`}>
                <img
                  src={
                    post.avatar_url ||
                    "https://via.placeholder.com/40/333333/FFFFFF?text=?"
                  }
                  style={{
                    width: 45,
                    height: 45,
                    borderRadius: "50%",
                    objectFit: "cover",
                    cursor: "pointer",
                  }}
                />
              </Link>

              <div>
                <Link
                  href={`/profile/${post.user_id}`}
                  style={{ color: "white", textDecoration: "none" }}
                >
                  <strong>{post.author_pseudo}</strong>
                </Link>

                {post.game && (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{post.game}</div>
                )}
              </div>
            </div>

            {/* --- TEXTE --- */}
            <p style={{ marginBottom: "10px" }}>{post.content}</p>

            {/* --- MEDIA --- */}
            {post.media_type === "image" && (
              <img
                src={post.media_url!}
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

            {/* --- COMMENTAIRES --- */}
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
