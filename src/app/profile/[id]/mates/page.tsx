"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

type MateInfo = {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
  since: string;
};

export default function MatesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [mates, setMates] = useState<MateInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadMates();
  }, [id]);

  const loadMates = async () => {
    setLoading(true);

    // On récupère toutes les relations mates où l’utilisateur est user1 ou user2
    const { data, error } = await supabase
      .from("mates")
      .select("*")
      .or(`user1.eq.${id},user2.eq.${id}`);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // On transforme les données pour avoir les infos du mate
    const mateList: MateInfo[] = [];

    for (const rel of data!) {
      const mateId = rel.user1 === id ? rel.user2 : rel.user1;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, pseudo, avatar_url")
        .eq("id", mateId)
        .single();

      if (profile) {
        mateList.push({
          id: profile.id,
          pseudo: profile.pseudo,
          avatar_url: profile.avatar_url,
          since: rel.start_date,
        });
      }
    }

    setMates(mateList);
    setLoading(false);
  };

  if (loading) return <p style={{ padding: 20 }}>Chargement...</p>;

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "750px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>
        Mates ({mates.length})
      </h1>

      {mates.length === 0 && <p>Aucun mate pour le moment.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mates.map((mate) => (
          <div
            key={mate.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: 12,
              background: "#111",
              borderRadius: 10,
              border: "1px solid #333",
              gap: 15,
            }}
          >
            {/* Avatar */}
            {mate.avatar_url ? (
              <Image
                src={mate.avatar_url}
                alt="avatar"
                width={60}
                height={60}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 60,
                  height: 60,
                  background: "#333",
                  borderRadius: "50%",
                }}
              ></div>
            )}

            {/* Infos */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 18, marginBottom: 4 }}>
                {mate.pseudo || "Utilisateur"}
              </p>

              <p style={{ fontSize: 12, color: "#999" }}>
                Mate depuis le{" "}
                {mate.since
  ? new Date(mate.since).toLocaleDateString("fr-FR")
  : "Date inconnue"}
              </p>
            </div>

            {/* Boutons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Link
                href={`/profile/${mate.id}`}
                style={{
                  padding: "6px 10px",
                  background: "#0070f3",
                  color: "white",
                  borderRadius: 6,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Voir profil
              </Link>

              <button
                onClick={() => router.push(`/messages/create?user=${mate.id}`)}
                style={{
                  padding: "6px 10px",
                  background: "green",
                  color: "white",
                  borderRadius: 6,
                  cursor: "pointer",
                  border: "none",
                }}
              >
                Message
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
