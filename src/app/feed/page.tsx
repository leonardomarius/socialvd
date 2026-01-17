"use client";

import { Suspense } from "react";
import GamesLobby from "@/components/GamesLobby";

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <GamesLobby />
    </Suspense>
  );
}
