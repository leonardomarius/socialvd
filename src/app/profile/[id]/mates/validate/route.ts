import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { mate_id, user_id } = await req.json();

  const { data: mate, error: mateError } = await supabase
    .from("mates")
    .select("*")
    .eq("id", mate_id)
    .single();

  if (!mate || mateError) {
    return NextResponse.json({ error: "Mate not found" }, { status: 404 });
  }

  if (mate.user1_id !== user_id && mate.user2_id !== user_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: alreadyValidated } = await supabase
    .from("mate_validations")
    .select("id")
    .eq("mate_id", mate_id)
    .eq("user_id", user_id)
    .eq("created_at", today);

  if (alreadyValidated && alreadyValidated.length > 0) {
    return NextResponse.json(
      { error: "Already validated today" },
      { status: 400 }
    );
  }

  await supabase.from("mate_validations").insert({
    mate_id,
    user_id,
  });

  const newCount = (mate.day_validation_count || 0) + 1;

  await supabase
    .from("mates")
    .update({ day_validation_count: newCount })
    .eq("id", mate_id);

  if (newCount >= 5) {
    await supabase
      .from("mates")
      .update({ status: "active" })
      .eq("id", mate_id);
  }

  return NextResponse.json({ success: true });
}
