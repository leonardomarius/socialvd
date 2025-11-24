import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { request_id, sender_id, receiver_id } = await req.json();

  // delete request
  await supabase.from("mate_requests").delete().eq("id", request_id);

  // create mate
  const { error } = await supabase.from("mates").insert({
    user1_id: sender_id,
    user2_id: receiver_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
