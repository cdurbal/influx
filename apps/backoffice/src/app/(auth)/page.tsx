import { LoginForm } from "@/components/LoginForm";

// Backoffice sign-in in one request: address, password and TOTP or recovery code (17b §3.14.a).
export default function LoginPage() {
  return <LoginForm />;
}
