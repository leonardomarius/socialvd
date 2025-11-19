"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MateRelation = {
  id: string;
  user1: string;
  user2: string;
  start_date: string | null;
  progress_user1: number;
  progress_user2: number;
  last_click_user1: string | null;
  last_click_user2: string | null;
};

export default function MateButton({
  myId,
  otherId,
}: {
  myId: string | null;
  otherId: string;
}) {
  const [relation, setRelation] = useState<MateRelation | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [canClick, setCanClick] = useState(false);

  useEffect(() => {
    if (!myId) return;
    loadRelation();
  }, [myId, otherId]);

  const loadRelation = async () => {
    setLoading(true);

    // 1) Vérifier si vous êtes DÉJÀ mates (table "mates")
    const { data: mateRow, error: mateErr } = await supabase
      .from("mates")
      .select("*")
      .or(
        `and(user1.eq.${myId},user2.eq.${otherId}),and(user1.eq.${otherId},user2.eq.${myId})`
      )
      .maybeSingle();

    if (mateErr) {
      console.error("Erreur load mates:", mateErr);
    }

    if (mateRow) {
      setRelation(null);
      setStatus("🔥 Vous êtes MATES !");
      setCanClick(false);
      setLoading(false);
      return;
    }

    // 2) Sinon, regarder s'il existe une demande / progression (table "mate_requests")
    const { data, error } = await supabase
      .from("mate_requests")
      .select("*")
      .or(
        `and(user1.eq.${myId},user2.eq.${otherId}),and(user1.eq.${otherId},user2.eq.${myId})`
      )
      .maybeSingle();

    if (error) {
      console.error("Erreur load mate_requests:", error);
      setLoading(false);
      return;
    }

    const rel = (data as MateRelation | null) || null;
    setRelation(rel);
    computeStatus(rel);
    setLoading(false);
  };

  const computeStatus = (rel: MateRelation | null) => {
    // Aucun lien encore → tu peux lancer la "quête mate"
    if (!rel) {
      setStatus("Devenir mates 🤝");
      setCanClick(true);
      return;
    }

    // Si les deux ont 5 → MATES (juste au cas où le cleanup n’a pas encore eu lieu)
    if (rel.progress_user1 >= 5 && rel.progress_user2 >= 5) {
      setStatus("🔥 Vous êtes MATES !");
      setCanClick(false);
      return;
    }

    const iAmUser1 = rel.user1 === myId;
    const myProgress = iAmUser1 ? rel.progress_user1 : rel.progress_user2;
    const otherProgress = iAmUser1 ? rel.progress_user2 : rel.progress_user1;
    const myLastClick = iAmUser1 ? rel.last_click_user1 : rel.last_click_user2;

    // Vérifier cooldown 24h
    if (myLastClick) {
      const nextClick = new Date(myLastClick);
      nextClick.setHours(nextClick.getHours() + 24);

      if (nextClick > new Date()) {
        setCanClick(false);

        const diff = nextClick.getTime() - new Date().getTime();
        const hours = Math.floor(diff / 1000 / 3600);
        const minutes = Math.floor((diff / 1000 / 60) % 60);

        setStatus(`⌛ Prochain clic dans ${hours}h ${minutes}m`);
        return;
      }
    }

    // En attente du tout premier clic
    if (myProgress === 0 && otherProgress === 0) {
      if (rel.user1 === myId) setStatus("Demande envoyée ✅");
      else setStatus("Demande reçue — cliquez pour accepter");
      setCanClick(true);
      return;
    }

    // Progression intermédiaire
    setStatus(`Progression : ${myProgress}/5 (autre : ${otherProgress}/5)`);
    setCanClick(true);
  };

  const handleClick = async () => {
    if (!myId) return;

    // 1) Pas encore de relation → créer une demande
    if (!relation) {
      const { data, error } = await supabase
        .from("mate_requests")
        .insert({
          user1: myId,
          user2: otherId,
          progress_user1: 0,
          progress_user2: 0,
          last_click_user1: null,
          last_click_user2: null,
          start_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Erreur création mate_requests:", error);
        alert("Erreur lors de la demande mate : " + error.message);
        return;
      }

      const rel = data as MateRelation;
      setRelation(rel);
      computeStatus(rel);
      return;
    }

    // 2) Relation existante → avancer la progression pour CE user
    const isUser1 = relation.user1 === myId;

    const updatedProgress = isUser1
      ? {
          progress_user1: relation.progress_user1 + 1,
          last_click_user1: new Date().toISOString(),
        }
      : {
          progress_user2: relation.progress_user2 + 1,
          last_click_user2: new Date().toISOString(),
        };

    const { data, error } = await supabase
      .from("mate_requests")
      .update(updatedProgress)
      .eq("id", relation.id)
      .select()
      .single();

    if (error) {
      console.error("Erreur update mate_requests:", error);
      alert("Erreur lors de la validation : " + error.message);
      return;
    }

    const newRel = data as MateRelation;
    setRelation(newRel);
    computeStatus(newRel);

    // Si terminé → déplacer dans table "mates"
    if (newRel.progress_user1 >= 5 && newRel.progress_user2 >= 5) {
      await supabase.from("mates").insert({
        user1: newRel.user1,
        user2: newRel.user2,
        start_date: newRel.start_date || new Date().toISOString(),
      });

      await supabase.from("mate_requests").delete().eq("id", newRel.id);

      alert("🔥 Félicitations, vous êtes maintenant MATES !");
      // on recharge pour afficher le statut final
      loadRelation();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!canClick}
      style={{
        padding: "8px 16px",
        background: canClick ? "#8b5cf6" : "#444",
        color: "white",
        borderRadius: 6,
        cursor: canClick ? "pointer" : "not-allowed",
        border: "none",
        minWidth: "170px",
        fontSize: 13,
      }}
    >
      {loading ? "..." : status}
    </button>
  );
}
