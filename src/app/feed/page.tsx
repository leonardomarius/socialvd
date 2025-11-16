"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Comment = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  users: {
    pseudo: string;
  };
};

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  users?: {
    pseudo: string;
  };
  comments?: Comment[];
  likeCount?: number;
  isLiked?: boolean;
};

export default function FeedPage() {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [posts, setPosts] = useState<Post[]>([]);

  // ----- Charger les posts + likes + comments + pseudo -----
  const fetchPosts = async () => {
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;

    const { data } = await supabase
      .from("posts")
      .select(`
        *,
        users:pseudo!inner (pseudo),
        likes (user_id),
        comments (
          id,
          content,
          user_id,
          created_at,
          users:pseudo (pseudo)
        )
      `)
      .order("created_at", { ascending: false });

    if (!data) return;

    const formatted = data.map((p: any) => ({
      ...p,
      likeCount: p.likes.length,
      isLiked: p.likes.some((l: any) => l.user_id === userId),
    }));

    setPosts(formatted);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // ----- Uploader une image -----
  const uploadImage = async () => {
    if (!imageFile) return null;

    const fileName = `${Date.now()}-${imageFile.name}`;
    const { error } = await supabase.storage
      .from("posts-images")
      .upload(fileName, imageFile);

    if (error) return null;

    return supabase.storage
      .from("posts-images")
      .getPublicUrl(fileName).data.publicUrl;
  };

  // ----- Créer un post -----
  const handleCreatePost = async () => {
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    if (!userId) return;

    let imageUrl = null;
    if (imageFile) imageUrl = await uploadImage();

    await supabase.from("posts").insert({
      user_id: userId,
      content,
      image_url: imageUrl,
    });

    setContent("");
    setImageFile(null);

    fetchPosts();
  };

  // ----- LIKE / UNLIKE -----
  const toggleLike = async (postId: string, isLiked: boolean) => {
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    if (!userId) return;

    if (isLiked) {
      await supabase.from("likes").delete().match({
        user_id: userId,
        post_id: postId,
      });
    } else {
      await supabase.from("likes").insert({
        user_id: userId,
        post_id: postId,
      });
    }

    fetchPosts();
  };

  // ----- COMMENTER -----
  const handleComment = async (postId: string) => {
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    if (!userId) return;

    const text = commentTexts[postId];
    if (!text || text.trim() === "") return;

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: userId,
      content: text,
    });

    setCommentTexts((prev) => ({ ...prev, [postId]: "" }));

    fetchPosts();
  };

  return (
    <div style={{ padding: 30, maxWidth: 600, margin: "0 auto" }}>
      <h1>Fil d’actualité</h1>

      {/* Formulaire */}
      <textarea
        placeholder="Écris quelque chose..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{
          width: "100%",
          height: 60,
          marginBottom: 10,
          padding: 10,
        }}
      />

      <input
        type="file"
        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        style={{ marginBottom: 10 }}
      />

      <button onClick={handleCreatePost}>Publier</button>

      {/* Liste des posts */}
      <div style={{ marginTop: 30 }}>
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              border: "1px solid #333",
              borderRadius: 10,
              padding: 15,
              marginBottom: 20,
              background: "#111",
              color: "white",
            }}
          >
            {/* 🔵 PSEUDO DE L'AUTEUR */}
            <p style={{ fontWeight: "bold" }}>{post.users?.pseudo}</p>

            {/* 📝 texte */}
            {post.content && <p>{post.content}</p>}

            {/* 🖼 image */}
            {post.image_url && (
              <img
                src={post.image_url}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  marginTop: 10,
                }}
              />
            )}

            {/* ❤️ LIKE */}
            <button
              onClick={() => toggleLike(post.id, post.isLiked!)}
              style={{
                marginTop: 10,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 22,
                color: post.isLiked ? "red" : "white",
              }}
            >
              {post.isLiked ? "❤️" : "🤍"} {post.likeCount}
            </button>

            {/* 💬 Liste des commentaires */}
            <div style={{ marginTop: 10 }}>
              {post.comments?.map((c) => (
                <p key={c.id} style={{ marginBottom: 5 }}>
                  <b>{c.users.pseudo}</b> : {c.content}
                </p>
              ))}
            </div>

            {/* 💬 Ajouter un commentaire */}
            <input
              placeholder="Commenter..."
              value={commentTexts[post.id] || ""}
              onChange={(e) =>
                setCommentTexts((prev) => ({
                  ...prev,
                  [post.id]: e.target.value,
                }))
              }
              style={{
                width: "100%",
                marginTop: 10,
                padding: 8,
              }}
            />

            <button
              onClick={() => handleComment(post.id)}
              style={{
                marginTop: 5,
                padding: 8,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Commenter
            </button>

            {/* Date */}
            <p style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
              {new Date(post.created_at).toLocaleString("fr-FR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
