import { Activation } from "@/components/Activation";

// TOTP activation in three steps, reached by the link /activation#<token> (17b §3.14.b and c).
export default function ActivationPage() {
  return <Activation />;
}
