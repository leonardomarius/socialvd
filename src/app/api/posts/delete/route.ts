import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { post_id, user_id } = await req.json();

    if (!post_id || !user_id) {
      return NextResponse.json(
        { error: "post_id ou user_id manquant" },
        { status: 400 }
      );
    }

    // ===== Supprimer uniquement si l’utilisateur est bien le propriétaire =====
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post_id)
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Post supprimé" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
