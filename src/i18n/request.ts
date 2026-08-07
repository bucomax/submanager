import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

async function loadMessages(locale: string) {
  switch (locale) {
    case "pt-BR":
      return {
        global: (await import("../../messages/pt-BR/global.json")).default,
        auth: (await import("../../messages/pt-BR/auth.json")).default,
        api: (await import("../../messages/pt-BR/api.json")).default,
        dashboard: (await import("../../messages/pt-BR/dashboard.json")).default,
        clients: (await import("../../messages/pt-BR/clients.json")).default,
        account: (await import("../../messages/pt-BR/account.json")).default,
        settings: (await import("../../messages/pt-BR/settings.json")).default,
        pathways: (await import("../../messages/pt-BR/pathways.json")).default,
        notifications: (await import("../../messages/pt-BR/notifications.json")).default,
        patientPortal: (await import("../../messages/pt-BR/patientPortal.json")).default,
        legal: (await import("../../messages/pt-BR/legal.json")).default,
        apps: (await import("../../messages/pt-BR/apps.json")).default,
        contacts: (await import("../../messages/pt-BR/contacts.json")).default,
      };
    case "en":
      return {
        global: (await import("../../messages/en/global.json")).default,
        auth: (await import("../../messages/en/auth.json")).default,
        api: (await import("../../messages/en/api.json")).default,
        dashboard: (await import("../../messages/en/dashboard.json")).default,
        clients: (await import("../../messages/en/clients.json")).default,
        account: (await import("../../messages/en/account.json")).default,
        settings: (await import("../../messages/en/settings.json")).default,
        pathways: (await import("../../messages/en/pathways.json")).default,
        notifications: (await import("../../messages/en/notifications.json")).default,
        patientPortal: (await import("../../messages/en/patientPortal.json")).default,
        legal: (await import("../../messages/en/legal.json")).default,
        apps: (await import("../../messages/en/apps.json")).default,
        contacts: (await import("../../messages/en/contacts.json")).default,
      };
    default:
      return {
        global: (await import("../../messages/pt-BR/global.json")).default,
        auth: (await import("../../messages/pt-BR/auth.json")).default,
        api: (await import("../../messages/pt-BR/api.json")).default,
        dashboard: (await import("../../messages/pt-BR/dashboard.json")).default,
        clients: (await import("../../messages/pt-BR/clients.json")).default,
        account: (await import("../../messages/pt-BR/account.json")).default,
        settings: (await import("../../messages/pt-BR/settings.json")).default,
        pathways: (await import("../../messages/pt-BR/pathways.json")).default,
        notifications: (await import("../../messages/pt-BR/notifications.json")).default,
        patientPortal: (await import("../../messages/pt-BR/patientPortal.json")).default,
        legal: (await import("../../messages/pt-BR/legal.json")).default,
        apps: (await import("../../messages/pt-BR/apps.json")).default,
        contacts: (await import("../../messages/pt-BR/contacts.json")).default,
      };
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "pt-BR" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
