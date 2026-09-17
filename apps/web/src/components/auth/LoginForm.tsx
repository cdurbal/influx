"use client";

import { useState, type KeyboardEvent } from "react";
import { EMAIL_SHAPE } from "@/components/landing/start-form-validation";
import { Button } from "@/components/ui/Button";
import {
  FieldError,
  inputClassName,
  RequiredMark,
} from "@/components/ui/form-controls";
import { useRouter } from "@/i18n/navigation";

export type LoginFormLabels = {
  requiredMark: string;
  email: { label: string; errorRequired: string; errorFormat: string };
  password: { label: string; hint: string; errorRequired: string };
  submit: string;
};

type LoginFormErrors = Partial<{
  email: "required" | "format";
  password: "required";
}>;

const ID = "login-form";

/**
 * Mocked login (docs/landing-page/00-cadrage.md §6): any well-formed e-mail and non-empty
 * password "log in" by navigating to /space. No request is sent and nothing is stored — this
 * simulates a session, it never checks credentials against a real account.
 */
export function LoginForm({ labels }: { labels: LoginFormLabels }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginFormErrors>({});

  function attemptLogin() {
    const nextErrors: LoginFormErrors = {};
    const trimmedEmail = email.trim();
    if (trimmedEmail === "") {
      nextErrors.email = "required";
    } else if (!EMAIL_SHAPE.test(trimmedEmail)) {
      nextErrors.email = "format";
    }
    if (password === "") {
      nextErrors.password = "required";
    }
    setErrors(nextErrors);
    if (nextErrors.email) {
      document.getElementById(`${ID}-email`)?.focus();
      return;
    }
    if (nextErrors.password) {
      document.getElementById(`${ID}-password`)?.focus();
      return;
    }
    router.push("/space");
  }

  function handleEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      attemptLogin();
    }
  }

  return (
    <form
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        attemptLogin();
      }}
      className="flex flex-col gap-stack-lg rounded-lg bg-surface-raised p-inset-card shadow-md"
    >
      <div className="flex flex-col gap-stack-sm">
        <label
          htmlFor={`${ID}-email`}
          className="font-semibold text-text-primary"
        >
          {labels.email.label}
          <RequiredMark mark={labels.requiredMark} />
        </label>
        <input
          id={`${ID}-email`}
          type="email"
          inputMode="email"
          required
          value={email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${ID}-email-error` : undefined}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={handleEnter}
          className={inputClassName(Boolean(errors.email))}
        />
        <FieldError
          id={`${ID}-email-error`}
          message={
            errors.email === "format"
              ? labels.email.errorFormat
              : errors.email && labels.email.errorRequired
          }
        />
      </div>

      <div className="flex flex-col gap-stack-sm">
        <label
          htmlFor={`${ID}-password`}
          className="font-semibold text-text-primary"
        >
          {labels.password.label}
          <RequiredMark mark={labels.requiredMark} />
        </label>
        <input
          id={`${ID}-password`}
          type="password"
          autoComplete="off"
          required
          value={password}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={
            errors.password ? `${ID}-password-error` : `${ID}-password-hint`
          }
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={handleEnter}
          className={inputClassName(Boolean(errors.password))}
        />
        <p id={`${ID}-password-hint`} className="text-sm text-text-tertiary">
          {labels.password.hint}
        </p>
        <FieldError
          id={`${ID}-password-error`}
          message={errors.password && labels.password.errorRequired}
        />
      </div>

      <Button variant="primary" fullWidth onClick={attemptLogin}>
        {labels.submit}
      </Button>
    </form>
  );
}
