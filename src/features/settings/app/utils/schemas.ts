import { z } from "zod";

import { digitsOnlyCep } from "@/lib/validators/cep";
import { digitsOnlyPhone } from "@/lib/validators/phone";
import { digitsOnlyTaxDocument } from "@/lib/validators/tax-document";
import { profileImageFormFieldSchema } from "@/lib/validators/profile";
import { portalPasswordSchema } from "@/lib/validators/patient-portal-auth";

export const inviteUserFormSchema = z.object({
  email: z.string().email("Email inválido."),
  name: z.string().max(120, "Máximo de 120 caracteres.").optional(),
  role: z.enum(["tenant_admin", "tenant_user"]),
});

export type InviteUserFormValues = z.infer<typeof inviteUserFormSchema>;

export const profileFormSchema = z.object({
  name: z.string().min(1, "Informe o nome.").max(120),
  image: profileImageFormFieldSchema.optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: portalPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

export const clinicSettingsFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da clínica.").max(120),
  /** Apenas dígitos (FormTaxDocument); vazio, CPF (11) ou CNPJ (14). */
  taxId: z
    .string()
    .max(14)
    .or(z.literal(""))
    .refine(
      (v) => {
        const d = digitsOnlyTaxDocument(v ?? "");
        return d.length === 0 || d.length === 11 || d.length === 14;
      },
      { message: "Informe CPF (11 dígitos) ou CNPJ (14 dígitos), ou deixe em branco." },
    )
    .optional(),
  /** Apenas dígitos (FormPhoneNumber); vazio ou 10–11 dígitos (BR com DDD). */
  phone: z
    .string()
    .max(11)
    .or(z.literal(""))
    .refine(
      (v) => {
        const d = digitsOnlyPhone(v ?? "");
        return d.length === 0 || (d.length >= 10 && d.length <= 11);
      },
      { message: "Telefone: informe DDD + número (10 ou 11 dígitos) ou deixe em branco." },
    )
    .optional(),
  addressLine: z.string().max(255, "Máximo de 255 caracteres.").optional(),
  city: z.string().max(120, "Máximo de 120 caracteres.").optional(),
  /** 8 dígitos (FormCep); vazio ou CEP completo. */
  postalCode: z
    .string()
    .max(8)
    .or(z.literal(""))
    .refine(
      (v) => {
        const d = digitsOnlyCep(v ?? "");
        return d.length === 0 || d.length === 8;
      },
      { message: "CEP: informe 8 dígitos ou deixe em branco." },
    )
    .optional(),
  affiliatedHospitals: z.string().max(10_000, "Máximo de 10000 caracteres.").optional(),
});

export type ClinicSettingsFormValues = z.infer<typeof clinicSettingsFormSchema>;

export const createTenantWizardSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da clínica.").max(120),
    slug: z
      .string()
      .trim()
      .min(2, "Mínimo de 2 caracteres.")
      .max(64, "Máximo de 64 caracteres.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use minúsculas, números e hífens."),
    /** Apenas dígitos (FormTaxDocument); vazio, CPF (11) ou CNPJ (14). */
    taxId: z
      .string()
      .max(14)
      .or(z.literal(""))
      .refine(
        (v) => {
          const d = digitsOnlyTaxDocument(v ?? "");
          return d.length === 0 || d.length === 11 || d.length === 14;
        },
        { message: "Informe CPF (11 dígitos) ou CNPJ (14 dígitos), ou deixe em branco." },
      ),
    /** Apenas dígitos (FormPhoneNumber); vazio ou 10–11 dígitos (BR com DDD). */
    phone: z
      .string()
      .max(11)
      .or(z.literal(""))
      .refine(
        (v) => {
          const d = digitsOnlyPhone(v ?? "");
          return d.length === 0 || (d.length >= 10 && d.length <= 11);
        },
        { message: "Telefone: informe DDD + número (10 ou 11 dígitos) ou deixe em branco." },
      ),
    addressLine: z.string().max(500).optional().or(z.literal("")),
    addressNumber: z.string().max(64).optional().or(z.literal("")),
    addressComp: z.string().max(120).optional().or(z.literal("")),
    neighborhood: z.string().max(200).optional().or(z.literal("")),
    city: z.string().max(120).optional().or(z.literal("")),
    /** 2 letras UF; preenchido pelo CEP. */
    state: z.string().max(2).optional().or(z.literal("")),
    /** 8 dígitos (FormCep); vazio ou CEP completo. */
    postalCode: z
      .string()
      .max(8)
      .or(z.literal(""))
      .refine(
        (v) => {
          const d = digitsOnlyCep(v ?? "");
          return d.length === 0 || d.length === 8;
        },
        { message: "CEP: informe 8 dígitos ou deixe em branco." },
      ),
    adminEmail: z.union([z.string().email("E-mail inválido."), z.literal("")]),
    adminName: z.string().max(120).optional().or(z.literal("")),
  })
  .refine((d) => !(d.adminName?.trim() && !d.adminEmail?.trim()), {
    message: "Informe o e-mail do administrador.",
    path: ["adminEmail"],
  });

export type CreateTenantWizardValues = z.infer<typeof createTenantWizardSchema>;
