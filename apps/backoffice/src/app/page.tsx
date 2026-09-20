import { redirect } from "next/navigation";

export default function BackofficeRootPage() {
  redirect("/queues/verification");
}
