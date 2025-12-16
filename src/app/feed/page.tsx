"use client";

import { Suspense } from "react";
import FeedView from "@/components/FeedView";

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <FeedView />
    </Suspense>
  );
}
