import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { sender_id, receiver_id } = await req.json();

  const { error } = await supabase.from("mate_requests").insert({
    sender_id,
    receiver_id,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
