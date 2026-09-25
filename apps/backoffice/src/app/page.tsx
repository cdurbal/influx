import { messages } from "@/messages/fr";

// Empty login page: the form (password, then TOTP) arrives at J3, after 17b (21 §4, J1-E).
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-(--container-max) flex-col justify-center gap-4 px-page-gutter">
      <h1 className="text-heading-3 font-bold">{messages.login.title}</h1>
      <p className="text-text-secondary">{messages.login.restricted}</p>
    </main>
  );
}
