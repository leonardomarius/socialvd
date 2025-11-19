import { Suspense } from "react";
import CreateConversationClient from "../create/CreateConversationClient";
export default function Page() {
  return (
    <Suspense fallback={<p>Chargement...</p>}>
      <CreateConversationClient />
    </Suspense>
  );
}
