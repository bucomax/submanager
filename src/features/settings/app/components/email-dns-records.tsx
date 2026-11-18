"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import type { TenantEmailDomainDto } from "@/types/api/email-domain-v1";

type EmailDnsRecordsProps = {
  dnsRecords: NonNullable<TenantEmailDomainDto["dnsRecords"]>;
  status: TenantEmailDomainDto["status"];
};

/** Tabela de registros DNS do domínio de envio, com botão de copiar por linha. */
export function EmailDnsRecords({ dnsRecords, status }: EmailDnsRecordsProps) {
  const t = useTranslations("settings.email");
  const tRoot = useTranslations("settings.whatsapp");

  const onCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(tRoot("copied"));
      } catch {
        toast.error("Copy failed");
      }
    },
    [tRoot],
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {status === "verified" ? t("dnsReferenceTitle") : t("dnsTitle")}
      </p>
      <p className="text-muted-foreground text-sm">
        {status === "verified" ? t("dnsWhenVerified") : t("dnsHint")}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Name</th>
              <th className="p-2 font-medium">Value</th>
              <th className="p-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {dnsRecords.map((r, i) => {
              const row = `${r.type}\t${r.name}\t${r.value}`;
              return (
                <tr key={i} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.type}</td>
                  <td className="max-w-[8rem] truncate p-2 font-mono text-xs" title={r.name}>
                    {r.name}
                  </td>
                  <td className="max-w-[12rem] truncate p-2 font-mono text-xs" title={r.value}>
                    {r.value}
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void onCopy(row)}>
                      <Copy className="size-4" />
                      {t("copy")}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
