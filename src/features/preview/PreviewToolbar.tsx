"use client";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export function PreviewToolbar({ host, onRefresh }: { host: string; onRefresh: () => void }) {
  const { t } = useI18n();

  return (
    <div className="border-b border-white/8 bg-background/90 px-4 py-2 flex items-center gap-2 text-xs select-none">
      <button className="p-1 opacity-25 cursor-not-allowed" disabled>
        <ArrowLeft className="w-3.5 h-3.5 text-foreground" />
      </button>
      <button className="p-1 opacity-25 cursor-not-allowed" disabled>
        <ArrowRight className="w-3.5 h-3.5 text-foreground" />
      </button>
      <div className="flex-1 text-center text-foreground/35 font-mono tracking-tight">{host}</div>
      <button
        className="p-1 text-foreground/40 hover:text-foreground/80 transition-colors"
        onClick={onRefresh}
        title={t("preview.toolbar.refresh")}
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
