"use client";

import { parsePortalLoginInput } from "@/domain/auth/patient-portal-login-identifier";
import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import { useRouter } from "@/i18n/navigation";
import {
  fetchPatientPortalLoginOptions,
  requestPatientPortalOtp,
  verifyPatientPortalOtp,
  verifyPatientPortalPassword,
} from "@/lib/api/patient-portal-client";
import { getErrorMessage } from "@/lib/utils/error-message";
import { digitsOnlyCpf } from "@/lib/validators/cpf";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

export type PatientPortalLoginStep = "identifier" | "password" | "sendOtp" | "code";

/** Máquina de passos do login do portal: identificador → senha ou OTP (enviar código → validar). */
export function usePatientPortalLogin(tenantSlug: string) {
  const t = useTranslations("patientPortal");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loginInput, setLoginInput] = useState("");
  /** Valor confirmado após o passo inicial (CPF ou e-mail), usado nas chamadas à API. */
  const [committedLogin, setCommittedLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<PatientPortalLoginStep>("identifier");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [postOtpRedirect, setPostOtpRedirect] = useState<string | null>(null);

  const homePath = `/${tenantSlug}/patient`;
  const options = useMutation({
    mutationFn: (login: string) => fetchPatientPortalLoginOptions(tenantSlug, login),
  });
  const passwordLogin = useMutation({
    mutationFn: (value: string) => verifyPatientPortalPassword(tenantSlug, committedLogin, value),
  });
  const requestOtp = useMutation({
    mutationFn: () => requestPatientPortalOtp(tenantSlug, committedLogin),
  });
  const verifyOtp = useMutation({
    mutationFn: (value: string) => verifyPatientPortalOtp(tenantSlug, committedLogin, value),
  });
  const loading =
    options.isPending || passwordLogin.isPending || requestOtp.isPending || verifyOtp.isPending;

  const trimmed = loginInput.trim();
  const identifierOk = Boolean(parsePortalLoginInput(trimmed));

  function clearFeedback() {
    setError(null);
    setInfo(null);
  }

  function onIdentifierChange(raw: string) {
    setLoginInput(raw.includes("@") ? raw : digitsOnlyCpf(raw));
  }

  /** Sessão nova: descarta o que estiver em cache do portal (ex.: 401 anterior). */
  function enterPortal(destination: string) {
    void queryClient.invalidateQueries({ queryKey: patientPortalKeys.all });
    router.replace(destination);
  }

  async function onContinueFromIdentifier() {
    clearFeedback();
    if (!identifierOk) {
      setError(t("login.identifierInvalid"));
      return;
    }
    try {
      const { hasPassword } = await options.mutateAsync(trimmed);
      setCommittedLogin(trimmed);
      setPassword("");
      if (hasPassword) {
        setStep("password");
      } else {
        setPostOtpRedirect(homePath);
        setStep("sendOtp");
      }
    } catch (e) {
      setError(getErrorMessage(e, t("login.optionsFailed")));
    }
  }

  async function onPasswordLogin() {
    clearFeedback();
    if (!password.trim()) {
      setError(t("login.passwordRequired"));
      return;
    }
    try {
      await passwordLogin.mutateAsync(password);
      enterPortal(homePath);
    } catch (e) {
      setError(getErrorMessage(e, t("login.passwordFailed")));
    }
  }

  function onForgotPassword() {
    clearFeedback();
    setPassword("");
    setCode("");
    setPostOtpRedirect(`${homePath}/set-password`);
    setStep("sendOtp");
  }

  async function onRequestCode() {
    clearFeedback();
    try {
      await requestOtp.mutateAsync();
      setInfo(t("login.codeSent"));
      setStep("code");
    } catch (e) {
      setError(getErrorMessage(e, t("login.requestFailed")));
    }
  }

  async function onVerifyOtp() {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("login.codeInvalid"));
      return;
    }
    try {
      await verifyOtp.mutateAsync(code.trim());
      enterPortal(postOtpRedirect ?? homePath);
    } catch (e) {
      setError(getErrorMessage(e, t("login.verifyFailed")));
    }
  }

  function goBackToIdentifier() {
    clearFeedback();
    setPassword("");
    setCode("");
    setCommittedLogin("");
    setPostOtpRedirect(null);
    setStep("identifier");
  }

  function goBackToSendOtp() {
    setCode("");
    setStep("sendOtp");
  }

  return {
    step,
    loading,
    error,
    info,
    loginInput,
    identifierOk,
    committedLogin,
    password,
    setPassword,
    code,
    setCode,
    onIdentifierChange,
    onContinueFromIdentifier,
    onPasswordLogin,
    onForgotPassword,
    onRequestCode,
    onVerifyOtp,
    goBackToIdentifier,
    goBackToSendOtp,
  };
}
