import type account from "../../messages/pt-BR/account.json";
import type api from "../../messages/pt-BR/api.json";
import type auth from "../../messages/pt-BR/auth.json";
import type clients from "../../messages/pt-BR/clients.json";
import type dashboard from "../../messages/pt-BR/dashboard.json";
import type global from "../../messages/pt-BR/global.json";
import type legal from "../../messages/pt-BR/legal.json";
import type notifications from "../../messages/pt-BR/notifications.json";
import type pathways from "../../messages/pt-BR/pathways.json";
import type patientPortal from "../../messages/pt-BR/patientPortal.json";
import type settings from "../../messages/pt-BR/settings.json";
import type apps from "../../messages/pt-BR/apps.json";
import type contacts from "../../messages/pt-BR/contacts.json";
import type agenda from "../../messages/pt-BR/agenda.json";
import type feedback from "../../messages/pt-BR/feedback.json";

// Tipos alinhados a `messages/pt-BR/*.json` (paridade com `en/` é manual).

type Messages = {
  global: typeof global;
  auth: typeof auth;
  api: typeof api;
  dashboard: typeof dashboard;
  clients: typeof clients;
  account: typeof account;
  settings: typeof settings;
  pathways: typeof pathways;
  notifications: typeof notifications;
  patientPortal: typeof patientPortal;
  legal: typeof legal;
  apps: typeof apps;
  contacts: typeof contacts;
  agenda: typeof agenda;
  feedback: typeof feedback;
};

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
  }
}
