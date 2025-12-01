import { supabase } from "@/lib/supabase";

// Vérifie le statut d'une relation entre deux users
export async function getMateStatus(myId: string, otherId: string) {
  // 1. vérifier s'ils sont déjà mates
  const { data: mates } = await supabase
    .from("mates")
    .select("*")
    .or(`and(user1.eq.${myId},user2.eq.${otherId}),and(user1.eq.${otherId},user2.eq.${myId})`)
    .maybeSingle();

  if (mates) {
    return { status: "mate", mates };
  }

  // 2. vérifier une demande en cours
  const { data: request } = await supabase
    .from("mates_requests")
    .select("*")
    .or(`and(user1.eq.${myId},user2.eq.${otherId}),and(user1.eq.${otherId},user2.eq.${myId})`)
    .maybeSingle();

  if (request) {
    return { status: "pending", request };
  }

  return { status: "none" };
}

// Crée une nouvelle demande
export async function startMateRequest(myId: string, otherId: string) {
  const { data, error } = await supabase
    .from("mates_requests")
    .insert({
      user1: myId,
      user2: otherId,
      day_count: 1,
      last_click: new Date().toISOString(),
      status: "pending"
    })
    .select()
    .single();

  return { data, error };
}

// Valide un jour supplémentaire
export async function validateMateDay(requestId: string, currentDay: number) {
  const { data, error } = await supabase
    .from("mates_requests")
    .update({
      day_count: currentDay + 1,
      last_click: new Date().toISOString()
    })
    .eq("id", requestId)
    .select()
    .single();

  return { data, error };
}
