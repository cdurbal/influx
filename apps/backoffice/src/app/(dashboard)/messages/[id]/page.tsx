import React from "react";
import { BackofficeConversationClient } from "./BackofficeConversationClient";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BackofficeConversationClient conversationId={id} />;
}
