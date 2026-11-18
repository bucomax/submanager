import bcrypt from "bcryptjs";

import type { PatientSelfRegisterDeps } from "@/application/use-cases/self-register/process-patient-self-register.core";
import { validatePublicInviteTenantSlug } from "@/application/use-cases/auth/validate-invite-tenant-slug";
import { notifyPatientSelfRegisterWelcome } from "@/infrastructure/email/notify-patient-self-register-welcome";
import { notifyStaffPatientSelfRegistered } from "@/infrastructure/email/notify-patient-self-registered";
import { patientSelfRegisterPrismaStore } from "@/infrastructure/repositories/patient-self-register-flow.repository";

const PASSWORD_HASH_ROUNDS = 12;

export const defaultPatientSelfRegisterDeps: PatientSelfRegisterDeps = {
  store: patientSelfRegisterPrismaStore,
  notifier: {
    notifyStaffPatientSelfRegistered,
    notifyPatientWelcome: notifyPatientSelfRegisterWelcome,
  },
  validateInviteTenantSlug: validatePublicInviteTenantSlug,
  hashPassword: (plain) => bcrypt.hash(plain, PASSWORD_HASH_ROUNDS),
};
