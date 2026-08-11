"use client";

import { useState } from "react";
import { useQuickPhrases } from "@/features/contacts/app/hooks/use-quick-phrases";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { Copy, Paperclip, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuickPhraseDto, UpsertQuickPhraseRequestBody } from "@/types/api/contacts-v1";

const VARIABLE_TOKENS = ["{{nome}}", "{{medico}}", "{{data}}"];

type QuickPhraseManagerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft?: string;
};

type EditorState = {
  id: string | null;
  slug: string;
  title: string;
  body: string;
  attachment: string;
};

const EMPTY_EDITOR: EditorState = { id: null, slug: "", title: "", body: "", attachment: "" };

export function QuickPhraseManagerDrawer({ open, onOpenChange, initialDraft }: QuickPhraseManagerDrawerProps) {
  const t = useTranslations("contacts.phrases");
  const { items, create, update, remove } = useQuickPhrases();
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  // Reseta o estado ao abrir/fechar o drawer — ajuste derivado durante o render
  // (não em efeito), como recomendado pelos React docs para "resetar estado quando prop muda".
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && initialDraft) {
      setEditor({ ...EMPTY_EDITOR, body: initialDraft });
    } else if (!open) {
      setEditor(null);
      setQuery("");
    }
  }

  const filtered = items.filter(
    (p) => p.slug.toLowerCase().includes(query.toLowerCase()) || p.title.toLowerCase().includes(query.toLowerCase()),
  );

  function startEdit(phrase: QuickPhraseDto) {
    setEditor({ id: phrase.id, slug: phrase.slug, title: phrase.title, body: phrase.body, attachment: phrase.attachment ?? "" });
  }

  async function duplicate(phrase: QuickPhraseDto) {
    try {
      await create({
        slug: `${phrase.slug}${t("duplicateSuffix")}`,
        title: `${phrase.title} ${t("duplicateLabel")}`,
        body: phrase.body,
        attachment: phrase.attachment,
      });
    } catch {
      toast.error(t("validation"));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await remove(id);
  }

  async function handleSubmit() {
    if (!editor) return;
    const slug = editor.slug.trim().toLowerCase();
    const body = editor.body.trim();
    if (!slug || !body) {
      toast.error(t("validation"));
      return;
    }
    const payload: UpsertQuickPhraseRequestBody = {
      slug,
      title: editor.title.trim() || slug,
      body,
      attachment: editor.attachment.trim() || null,
    };
    try {
      if (editor.id) {
        await update(editor.id, payload);
      } else {
        await create(payload);
      }
      setEditor(null);
    } catch {
      toast.error(t("validation"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[680px]">
        <SheetHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Zap className="size-4" />
            </span>
            <div>
              <SheetTitle>{t("title")}</SheetTitle>
              <SheetDescription>{t("subtitle")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {editor ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("shortcutLabel")}</label>
                <div className="flex items-center gap-1 rounded-lg border px-2.5">
                  <span className="font-mono text-sm text-muted-foreground">/</span>
                  <input
                    value={editor.slug}
                    onChange={(e) =>
                      setEditor((prev) => prev && { ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                    }
                    className="h-9 flex-1 bg-transparent font-mono text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("shortcutHint")}</p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("titleLabel")}</label>
                <Input
                  value={editor.title}
                  onChange={(e) => setEditor((prev) => prev && { ...prev, title: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("bodyLabel")}</label>
                <textarea
                  value={editor.body}
                  onChange={(e) => setEditor((prev) => prev && { ...prev, body: e.target.value })}
                  rows={7}
                  className="w-full resize-none rounded-lg border bg-transparent p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {VARIABLE_TOKENS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setEditor((prev) => prev && { ...prev, body: `${prev.body}${token}` })}
                      className="rounded-md bg-muted px-2 py-1 font-mono text-xs"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t("attachmentLabel")}</label>
                <Input
                  value={editor.attachment}
                  onChange={(e) => setEditor((prev) => prev && { ...prev, attachment: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">{editor.id ? t("futureHint") : t("teamHint")}</p>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditor(null)}>
                    {t("cancel")}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleSubmit()}>
                    {editor.id ? t("save") : t("create")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="h-9 pl-8"
                  />
                </div>
                <Button type="button" size="sm" onClick={() => setEditor(EMPTY_EDITOR)}>
                  <Plus className="size-3.5" />
                  {t("new")}
                </Button>
              </div>

              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <ul className="divide-y">
                  {filtered.map((phrase) => (
                    <li key={phrase.id} className="flex items-start gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-extrabold">
                            /{phrase.slug}
                          </span>
                          <span className="text-sm font-bold">{phrase.title}</span>
                          {phrase.attachment && <Paperclip className="size-3 text-muted-foreground" />}
                          {/\{\{[a-z]+\}\}/.test(phrase.body) && (
                            <span className="rounded bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#047857] dark:bg-emerald-950 dark:text-emerald-400">
                              {t("variables")}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{phrase.body}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => startEdit(phrase)}
                                aria-label={t("edit")}
                                className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>{t("edit")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => void duplicate(phrase)}
                                aria-label={t("duplicate")}
                                className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
                              >
                                <Copy className="size-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>{t("duplicate")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => void handleDelete(phrase.id)}
                                aria-label={t("delete")}
                                className="flex size-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>{t("delete")}</TooltipContent>
                        </Tooltip>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
