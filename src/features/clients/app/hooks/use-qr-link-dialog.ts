"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

type QrLink = { url: string; expiresAt: string };

/**
 * Estado compartilhado dos diálogos que geram um link + QR sob demanda
 * (acesso ao portal e auto-cadastro). O link é gerado a cada abertura.
 */
export function useQrLinkDialog(fetchLink: () => Promise<QrLink>) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({ mutationFn: fetchLink });

  function openDialog() {
    setOpen(true);
    mutation.mutate();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) mutation.reset();
  }

  return {
    open,
    openDialog,
    onOpenChange,
    loading: mutation.isPending,
    failed: mutation.isError,
    url: mutation.data?.url ?? null,
    expiresAt: mutation.data?.expiresAt ?? null,
  };
}
