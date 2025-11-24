import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { request_id } = await req.json();

  await supabase.from("mate_requests").delete().eq("id", request_id);

  return NextResponse.json({ success: true });
}
