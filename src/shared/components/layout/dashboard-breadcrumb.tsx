"use client";

import { apiClient } from "@/lib/api/http-client";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

function dashboardSegments(pathname: string): string[] {
  return pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean)
    .slice(0, 2);
}

type NavT = ReturnType<typeof useTranslations<"dashboard.nav">>;

function staticSegmentLabel(segment: string, tNav: NavT): string {
  if (segment === "clients") return tNav("clients");
  if (segment === "pathways") return tNav("pathways");
  if (segment === "patient-pathways") return tNav("pathways");
  if (segment === "attendance") return tNav("attendance");
  if (segment === "files") return tNav("files");
  if (segment === "account") return tNav("accountPage");
  if (segment === "settings") return tNav("settings");
  if (segment === "reports") return tNav("reports");
  if (segment === "new") return tNav("new");
  return segment;
}

/**
 * Resolve o último segmento do breadcrumb (IDs de entidade) para nome legível via API v1.
 */
export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const tNav = useTranslations("dashboard.nav");
  const segments = useMemo(() => dashboardSegments(pathname), [pathname]);
  const segmentsKey = segments.join("/");
  // O nome resolvido carrega a rota de origem: ao trocar de rota ele deixa de casar e
  // o render volta ao rótulo bruto sem precisar de um reset em efeito.
  const [resolved, setResolved] = useState<{ key: string; name: string } | null>(null);
  const resolvedSecond = resolved?.key === segmentsKey ? resolved.name : null;

  useEffect(() => {
    if (segments.length !== 2) return;

    const [first, second] = segments;
    if (!second || second === "new") return;

    const ac = new AbortController();

    async function resolve() {
      try {
        if (first === "clients") {
          const { data } = await apiClient.get<{ data: { client: { name: string } } }>(
            `/api/v1/clients/${second}`,
            { signal: ac.signal, skipErrorToast: true },
          );
          const name = data?.data?.client?.name?.trim();
          if (name) setResolved({ key: segmentsKey, name });
          return;
        }
        if (first === "pathways") {
          const { data } = await apiClient.get<{ data: { pathway: { name: string } } }>(
            `/api/v1/pathways/${second}`,
            { signal: ac.signal },
          );
          const name = data?.data?.pathway?.name?.trim();
          if (name) setResolved({ key: segmentsKey, name });
          return;
        }
        if (first === "patient-pathways") {
          const { data } = await apiClient.get<{
            data: { patientPathway: { client: { name: string } } };
          }>(`/api/v1/patient-pathways/${second}`, { signal: ac.signal, skipErrorToast: true });
          const name = data?.data?.patientPathway?.client?.name?.trim();
          if (name) setResolved({ key: segmentsKey, name });
        }
      } catch {
        /* 401/404: mantém o segmento bruto */
      }
    }

    void resolve();
    return () => ac.abort();
  }, [segments, segmentsKey]);

  const breadcrumbLabels = useMemo(() => {
    if (segments.length === 0) return [];
    if (segments.length === 1) {
      return [staticSegmentLabel(segments[0]!, tNav)];
    }
    const firstLabel = staticSegmentLabel(segments[0]!, tNav);
    const rawSecond = segments[1]!;
    const secondLabel = resolvedSecond ?? staticSegmentLabel(rawSecond, tNav);
    return [firstLabel, secondLabel];
  }, [segments, resolvedSecond, tNav]);

  return (
    <div className="text-muted-foreground hidden min-w-0 items-center gap-1 text-xs sm:flex">
      <span className="shrink-0">{tNav("home")}</span>
      {breadcrumbLabels.map((label, index) => (
        <span key={`${label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
          <span className="shrink-0">/</span>
          <span className="text-foreground truncate" title={label}>
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}
