import { GuardianRelationship, PatientPreferredChannel } from "@prisma/client";
import { z } from "zod";

import { zodApiMsg } from "@/lib/api/zod-i18n";
import { todayIsoDateLocal } from "@/lib/utils/date";
import { portalPasswordSchema } from "@/lib/validators/patient-portal-auth";
import { digitsOnlyCep } from "@/lib/validators/cep";
import { digitsOnlyCpf } from "@/lib/validators/cpf";
import { digitsOnlyPhone, phoneDigitsSchema } from "@/lib/validators/phone";

/** E-mail opcional no base; obrigatoriedade forçada via `refineAdultRequiredFields`. */
const optionalEmail = z.preprocess(
  (v) => {
    if (v == null) return "";
    const s = String(v).trim();
    return s === "" ? "" : s;
  },
  z.union([z.literal(""), z.string().max(320).email({ message: zodApiMsg("errors.validationEmailInvalid") })]),
);

/** Telefone opcional no base; obrigatoriedade forçada via `refineAdultRequiredFields`. */
const optionalPhone = z.preprocess(
  (v) => {
    if (v == null) return "";
    const s = digitsOnlyPhone(String(v));
    return s === "" ? "" : s;
  },
  z.union([z.literal(""), phoneDigitsSchema]),
);

const patchPhone = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return "";
    return digitsOnlyPhone(String(v));
  },
  z.union([z.undefined(), phoneDigitsSchema]),
);

function trimOpt(max: number) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      return s === "" ? undefined : s;
    },
    z.string().min(1).max(max).optional(),
  );
}

const addressFieldsCreate = {
  postalCode: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const d = digitsOnlyCep(String(v));
      return d === "" ? undefined : d;
    },
    z.union([z.undefined(), z.string().length(8)]),
  ),
  addressLine: trimOpt(500),
  addressNumber: trimOpt(64),
  addressComp: trimOpt(120),
  neighborhood: trimOpt(200),
  city: trimOpt(200),
  state: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim().toUpperCase();
      return s === "" ? undefined : s;
    },
    z.union([z.undefined(), z.string().length(2)]),
  ),
};

const guardianFieldsCreate = {
  guardianName: trimOpt(200),
  guardianDocumentId: z.preprocess(
    (v) => (v === undefined || v === null ? undefined : String(v)),
    z.union([z.undefined(), z.string().max(64)]),
  ),
  guardianPhone: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const d = digitsOnlyPhone(String(v));
      return d === "" ? undefined : d;
    },
    z.union([z.undefined(), phoneDigitsSchema]),
  ),
  guardianEmail: z.preprocess(
    (v) => (v === undefined || v === null ? undefined : String(v).trim()),
    z.union([z.undefined(), z.literal(""), z.string().email().max(320)]),
  ),
};

const birthDateField = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  },
  z.union([z.undefined(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
);

const extendedProfileFieldsCreate = {
  birthDate: birthDateField,
  guardianRelationship: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? undefined : v),
    z.union([z.undefined(), z.nativeEnum(GuardianRelationship)]),
  ),
  emergencyContactName: trimOpt(200),
  emergencyContactPhone: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const d = digitsOnlyPhone(String(v));
      return d === "" ? undefined : d;
    },
    z.union([z.undefined(), phoneDigitsSchema]),
  ),
  preferredChannel: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return PatientPreferredChannel.none;
      return v;
    },
    z.nativeEnum(PatientPreferredChannel),
  ),
};

const documentIdRawForCreate = z.preprocess(
  (v) => (v === undefined || v === null ? "" : String(v)),
  z.string().max(64),
);

const clientCreateObject = z.object({
  name: z.string().min(1).max(200),
  phone: optionalPhone,
  email: optionalEmail,
  caseDescription: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      return s === "" ? undefined : s;
    },
    z.string().max(20_000).optional(),
  ),
  documentId: documentIdRawForCreate,
  assignedToUserId: z.string().cuid().nullable().optional(),
  opmeSupplierId: z.string().cuid().nullable().optional(),
  isMinor: z.boolean().default(false),
  ...addressFieldsCreate,
  ...guardianFieldsCreate,
  ...extendedProfileFieldsCreate,
});

function refineAdultRequiredFields(
  data: { isMinor: boolean; email: string; phone: string },
  ctx: z.RefinementCtx,
) {
  if (data.isMinor) return;
  if (!data.email || data.email.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: zodApiMsg("errors.validationEmailRequired"),
    });
  }
  if (!data.phone || data.phone.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phone"],
      message: zodApiMsg("errors.validationPhoneBrDigits"),
    });
  }
}

/** Retorna true se a string YYYY-MM-DD representa uma data real no calendário. */
function isRealCalendarDate(ymd: string): boolean {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return false;
  const [y, m, day] = ymd.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

function refineBirthDateNotFuture(
  data: { birthDate?: string | null | undefined },
  ctx: z.RefinementCtx,
) {
  const b = data.birthDate;
  if (b === undefined || b === null || b === "") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return;
  if (!isRealCalendarDate(b)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["birthDate"],
      message: zodApiMsg("errors.validationBirthDateInvalid"),
    });
    return;
  }
  const today = todayIsoDateLocal();
  if (b > today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["birthDate"],
      message: zodApiMsg("errors.validationBirthDateFuture"),
    });
  }
}

function refineEmergencyContact(
  data: { emergencyContactName?: string | undefined; emergencyContactPhone?: string | undefined },
  ctx: z.RefinementCtx,
) {
  const n = data.emergencyContactName?.trim() ?? "";
  const ph = digitsOnlyPhone(data.emergencyContactPhone ?? "");
  if (n.length > 0 && ph.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactPhone"],
      message: zodApiMsg("errors.validationEmergencyPhoneRequired"),
    });
  }
  if (ph.length > 0 && n.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactName"],
      message: zodApiMsg("errors.validationEmergencyNameRequired"),
    });
  }
}

function refineEmergencyContactPatch(
  data: {
    emergencyContactName?: string | null | undefined;
    emergencyContactPhone?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (data.emergencyContactName === undefined && data.emergencyContactPhone === undefined) return;
  const n =
    data.emergencyContactName === undefined || data.emergencyContactName === null
      ? ""
      : String(data.emergencyContactName).trim();
  const ph =
    data.emergencyContactPhone === undefined || data.emergencyContactPhone === null
      ? ""
      : digitsOnlyPhone(String(data.emergencyContactPhone));
  if (n.length > 0 && ph.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactPhone"],
      message: zodApiMsg("errors.validationEmergencyPhoneRequired"),
    });
  }
  if (ph.length > 0 && n.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactName"],
      message: zodApiMsg("errors.validationEmergencyNameRequired"),
    });
  }
}

function refineMinorGuardianCpf(
  data: {
    isMinor: boolean;
    documentId: string;
    guardianName?: string | undefined;
    guardianDocumentId?: string | undefined;
    guardianRelationship?: GuardianRelationship | undefined;
  },
  ctx: z.RefinementCtx,
) {
  const doc = digitsOnlyCpf(data.documentId);
  if (data.isMinor) {
    if (!data.guardianRelationship) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianRelationship"],
        message: zodApiMsg("errors.validationGuardianRelationshipRequired"),
      });
    }
    if (!data.guardianName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianName"],
        message: zodApiMsg("errors.validationGuardianNameRequired"),
      });
    }
    const gDoc = digitsOnlyCpf(data.guardianDocumentId ?? "");
    if (gDoc.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianDocumentId"],
        message: zodApiMsg("errors.validationGuardianCpfRequired"),
      });
    }
    if (doc.length > 0 && doc.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentId"],
        message: zodApiMsg("errors.validationCpf11Digits"),
      });
    }
  } else {
    if (doc.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentId"],
        message: zodApiMsg("errors.validationCpfRequired"),
      });
    } else if (doc.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentId"],
        message: zodApiMsg("errors.validationCpf11Digits"),
      });
    }
  }
}

export type ClientCreateNormalized = {
  name: string;
  phone: string;
  email: string | null;
  caseDescription: string | null;
  documentId: string | null;
  assignedToUserId: string | null;
  opmeSupplierId: string | null;
  isMinor: boolean;
  postalCode: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComp: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  guardianName: string | null;
  guardianDocumentId: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  birthDate: Date | null;
  guardianRelationship: GuardianRelationship | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  preferredChannel: PatientPreferredChannel;
};

function parseBirthDateOnly(isoYmd: string | undefined): Date | null {
  const s = isoYmd?.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeClientCreatePayload(
  data: z.infer<typeof clientCreateObject>,
): ClientCreateNormalized {
  const doc = digitsOnlyCpf(data.documentId);
  const gPhone = data.guardianPhone;
  const gEmail =
    typeof data.guardianEmail === "string" && data.guardianEmail.trim() !== ""
      ? data.guardianEmail.trim()
      : null;
  const emName = data.emergencyContactName?.trim() || null;
  const emPhoneRaw = data.emergencyContactPhone;
  const emPhone =
    emPhoneRaw && digitsOnlyPhone(emPhoneRaw).length > 0 ? digitsOnlyPhone(emPhoneRaw) : null;
  return {
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim() || null,
    caseDescription: data.caseDescription?.trim() || null,
    documentId: data.isMinor && doc.length === 0 ? null : doc,
    assignedToUserId: data.assignedToUserId ?? null,
    opmeSupplierId: data.opmeSupplierId ?? null,
    isMinor: data.isMinor,
    postalCode: data.postalCode ?? null,
    addressLine: data.addressLine ?? null,
    addressNumber: data.addressNumber ?? null,
    addressComp: data.addressComp ?? null,
    neighborhood: data.neighborhood ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    guardianName: data.isMinor ? data.guardianName!.trim() : null,
    guardianDocumentId: data.isMinor ? digitsOnlyCpf(data.guardianDocumentId!) : null,
    guardianPhone: data.isMinor && gPhone && gPhone.length > 0 ? gPhone : null,
    guardianEmail: data.isMinor ? gEmail : null,
    birthDate: parseBirthDateOnly(data.birthDate),
    guardianRelationship: data.isMinor ? (data.guardianRelationship ?? null) : null,
    emergencyContactName: emName,
    emergencyContactPhone: emPhone,
    preferredChannel: data.preferredChannel ?? PatientPreferredChannel.none,
  };
}

export const postClientBodySchema = clientCreateObject
  .superRefine((data, ctx) => refineAdultRequiredFields(data, ctx))
  .superRefine((data, ctx) => refineMinorGuardianCpf(data, ctx))
  .superRefine((data, ctx) => refineEmergencyContact(data, ctx))
  .superRefine((data, ctx) => refineBirthDateNotFuture(data, ctx))
  .transform((data) => normalizeClientCreatePayload(data));

const publicPatientSelfRegisterObject = clientCreateObject
  .omit({ assignedToUserId: true, opmeSupplierId: true })
  .extend({
    token: z.string().min(1).max(128),
    password: portalPasswordSchema,
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: zodApiMsg("errors.validationConsentTermsRequired"),
    }),
    acceptPrivacy: z.boolean().refine((v) => v === true, {
      message: zodApiMsg("errors.validationConsentPrivacyRequired"),
    }),
  });

/** Formulário público (sem `token`; validação alinhada ao POST com token). */
export const patientSelfRegisterFormSchema = clientCreateObject
  .omit({ assignedToUserId: true, opmeSupplierId: true })
  .extend({
    password: z.string(),
    confirmPassword: z.string(),
    acceptTerms: z.boolean(),
    acceptPrivacy: z.boolean(),
  })
  .superRefine((data, ctx) => {
    refineAdultRequiredFields(data, ctx);
    refineBirthDateNotFuture(data, ctx);
    refineMinorGuardianCpf(data, ctx);
    refineEmergencyContact(data, ctx);
    const pw = portalPasswordSchema.safeParse(data.password);
    if (!pw.success) {
      for (const issue of pw.error.issues) {
        ctx.addIssue({ ...issue, path: ["password"] });
      }
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: zodApiMsg("errors.validationPortalPasswordMismatch"),
      });
    }
    if (data.acceptTerms !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptTerms"],
        message: zodApiMsg("errors.validationConsentTermsRequired"),
      });
    }
    if (data.acceptPrivacy !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptPrivacy"],
        message: zodApiMsg("errors.validationConsentPrivacyRequired"),
      });
    }
  });

/** Cadastro público via link/QR (sem responsável nem OPME). */
export const publicPatientSelfRegisterBodySchema = publicPatientSelfRegisterObject
  .superRefine((data, ctx) => {
    const { token: _token, password: _pw, acceptTerms: _at, acceptPrivacy: _ap, ...rest } = data;
    void _token;
    void _pw;
    void _at;
    void _ap;
    refineAdultRequiredFields(rest, ctx);
    refineBirthDateNotFuture(rest, ctx);
    refineMinorGuardianCpf(rest, ctx);
    refineEmergencyContact(rest, ctx);
  })
  .transform((data) => {
    const { token, password, acceptTerms: _acceptTerms, acceptPrivacy: _acceptPrivacy, ...rest } = data;
    void _acceptTerms;
    void _acceptPrivacy;
    return { ...normalizeClientCreatePayload(rest), token, password };
  });

/** Corpo opcional de `POST /api/v1/clients/self-register-invites` (convite genérico ou ligado a um paciente). */
export const postPatientSelfRegisterInviteBodySchema = z.object({
  clientId: z.string().cuid().optional(),
});

function nullableTrimmed(max: number) {
  return z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    },
    z.union([z.undefined(), z.null(), z.string().max(max)]),
  );
}

const patchClientBodyBaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: patchPhone,
  email: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    },
    z.union([z.undefined(), z.null(), z.string().email().max(320)]),
  ),
  caseDescription: z.string().max(20_000).nullable().optional(),
  documentId: z.union([z.null(), z.string()]).optional(),
  assignedToUserId: z.string().cuid().nullable().optional(),
  opmeSupplierId: z.string().cuid().nullable().optional(),
  isMinor: z.boolean().optional(),
  postalCode: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const d = digitsOnlyCep(String(v));
      return d === "" ? null : d;
    },
    z.union([z.undefined(), z.null(), z.string().length(8)]),
  ).optional(),
  addressLine: nullableTrimmed(500).optional(),
  addressNumber: nullableTrimmed(64).optional(),
  addressComp: nullableTrimmed(120).optional(),
  neighborhood: nullableTrimmed(200).optional(),
  city: nullableTrimmed(200).optional(),
  state: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim().toUpperCase();
      return s === "" ? null : s;
    },
    z.union([z.undefined(), z.null(), z.string().length(2)]),
  ).optional(),
  guardianName: nullableTrimmed(200).optional(),
  guardianDocumentId: z.union([z.null(), z.string()]).optional(),
  guardianPhone: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const d = digitsOnlyPhone(String(v));
      return d === "" ? null : d;
    },
    z.union([z.undefined(), z.null(), phoneDigitsSchema]),
  ).optional(),
  guardianEmail: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    },
    z.union([z.undefined(), z.null(), z.string().email().max(320)]),
  ).optional(),
  birthDate: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    },
    z.union([z.undefined(), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  ).optional(),
  guardianRelationship: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      return v;
    },
    z.union([z.undefined(), z.null(), z.nativeEnum(GuardianRelationship)]),
  ).optional(),
  emergencyContactName: nullableTrimmed(200).optional(),
  emergencyContactPhone: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const d = digitsOnlyPhone(String(v));
      return d === "" ? null : d;
    },
    z.union([z.undefined(), z.null(), phoneDigitsSchema]),
  ).optional(),
  preferredChannel: z.nativeEnum(PatientPreferredChannel).optional(),
});

export const patchClientBodySchema = patchClientBodyBaseSchema.superRefine((data, ctx) => {
  refineBirthDateNotFuture(data, ctx);

  // Adulto não pode ter email/phone removido (null/vazio)
  if (data.isMinor !== true) {
    if (data.email !== undefined && (data.email === null || data.email === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: zodApiMsg("errors.validationEmailRequired"),
      });
    }
    if (data.phone !== undefined && data.phone === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: zodApiMsg("errors.validationPhoneBrDigits"),
      });
    }
  }

  if (data.documentId !== undefined && data.documentId !== null) {
    const d = digitsOnlyCpf(data.documentId);
    if (d.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentId"],
        message: zodApiMsg("errors.validationCpfRequired"),
      });
    } else if (d.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentId"],
        message: zodApiMsg("errors.validationCpf11Digits"),
      });
    }
  }
  if (data.documentId === null && data.isMinor !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["documentId"],
      message: zodApiMsg("errors.validationCpfCannotRemove"),
    });
  }
  if (data.isMinor === true) {
    const gName = data.guardianName;
    if (gName === undefined || gName === null || String(gName).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianName"],
        message: zodApiMsg("errors.validationGuardianNameRequired"),
      });
    }
    const gRaw = data.guardianDocumentId;
    if (gRaw === undefined || gRaw === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianDocumentId"],
        message: zodApiMsg("errors.validationGuardianCpfRequired"),
      });
    } else {
      const g = digitsOnlyCpf(gRaw);
      if (g.length !== 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guardianDocumentId"],
          message: zodApiMsg("errors.validationCpf11Digits"),
        });
      }
    }
    if (data.guardianRelationship === undefined || data.guardianRelationship === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianRelationship"],
        message: zodApiMsg("errors.validationGuardianRelationshipRequired"),
      });
    }
  }
  refineEmergencyContactPatch(data, ctx);
});
