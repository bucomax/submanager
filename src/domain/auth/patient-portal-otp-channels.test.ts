import { describe, expect, it } from "vitest";

import { resolvePortalOtpDelivery, type PortalOtpClientContacts } from "./patient-portal-otp-channels";

const adult: PortalOtpClientContacts = {
  name: "Ana",
  email: " ana@x.com ",
  phone: "(11) 99999-0000",
  isMinor: false,
  guardianEmail: "resp@x.com",
  guardianPhone: "11 98888-0000",
};
const both = { canEmail: true, hasWebhook: true };

describe("resolvePortalOtpDelivery", () => {
  it("should deliver only to the adult patient and ignore guardian contacts", () => {
    expect(resolvePortalOtpDelivery(adult, both)).toEqual({
      emailReady: true,
      wppReady: true,
      emailRecipients: ["ana@x.com"],
      phoneRecipients: ["(11) 99999-0000"],
    });
  });

  it("should also reach a distinct guardian for minors", () => {
    const result = resolvePortalOtpDelivery({ ...adult, isMinor: true }, both);
    expect(result.emailRecipients).toEqual(["ana@x.com", "resp@x.com"]);
    expect(result.phoneRecipients).toEqual(["(11) 99999-0000", "11 98888-0000"]);
  });

  it("should not duplicate the guardian when it matches the patient e-mail or phone", () => {
    const result = resolvePortalOtpDelivery(
      { ...adult, isMinor: true, guardianEmail: "ANA@x.com", guardianPhone: "11999990000" },
      both,
    );
    expect(result.emailRecipients).toEqual(["ana@x.com"]);
    expect(result.phoneRecipients).toEqual(["(11) 99999-0000"]);
  });

  it("should be ready by e-mail through the guardian when a minor has no own e-mail", () => {
    const result = resolvePortalOtpDelivery(
      { ...adult, isMinor: true, email: null, phone: null, guardianPhone: null },
      { canEmail: true, hasWebhook: false },
    );
    expect(result).toMatchObject({ emailReady: true, wppReady: false, emailRecipients: ["resp@x.com"] });
  });

  it("should not be ready on any channel when e-mail is unavailable and there is no webhook", () => {
    const result = resolvePortalOtpDelivery(adult, { canEmail: false, hasWebhook: false });
    expect(result).toMatchObject({ emailReady: false, wppReady: false });
  });

  it("should require at least 10 phone digits for WhatsApp", () => {
    expect(resolvePortalOtpDelivery({ ...adult, phone: "119999" }, both).wppReady).toBe(false);
  });
});
