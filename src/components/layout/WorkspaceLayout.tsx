"use client"

import React from "react"
import { MessageSquare, Edit3, Sparkles, Eye } from "lucide-react"
import { useI18n } from "@/i18n/provider"

export type WorkspaceTab = "Generate" | "Edit" | "Preview"

interface LayoutProps {
  children: {
    chat: React.ReactNode
    edit: React.ReactNode
    preview: React.ReactNode
  }
  isMobile: boolean
  tab: WorkspaceTab
  setTab: (tab: WorkspaceTab) => void
}

export function Layout({ children, isMobile, tab, setTab }: LayoutProps) {
  const { t } = useI18n()

  if (isMobile) {
    return (
      <div
        className="flex flex-col bg-background overflow-hidden"
        style={{
          height: "100dvh",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Top brand bar */}
        <header className="shrink-0 flex items-center justify-center gap-2 border-b border-white/8 bg-background/95 backdrop-blur px-3 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-[#c15f3c]" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-foreground/60 select-none">
            Builder
          </span>
        </header>

        {/* Content area — ALL panels mounted, just toggled with display */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <PanelHost active={tab === "Generate"}>
            <div className="flex h-full flex-col px-3 pt-3">{children.chat}</div>
          </PanelHost>
          <PanelHost active={tab === "Preview"}>
            <div className="flex h-full flex-col">{children.preview}</div>
          </PanelHost>
          <PanelHost active={tab === "Edit"}>
            <div className="flex h-full flex-col overflow-y-auto px-3 pt-3 pb-4">{children.edit}</div>
          </PanelHost>
        </div>

        {/* Bottom nav — 3 tabs, touch-friendly (44px min) */}
        <nav className="shrink-0 flex border-t border-white/8 bg-background/95 backdrop-blur">
          <MobileTabBtn
            label={t("workspace.mobile.chat")}
            icon={<MessageSquare className="h-[18px] w-[18px]" />}
            active={tab === "Generate"}
            onClick={() => setTab("Generate")}
          />
          <MobileTabBtn
            label={t("workspace.mobile.preview")}
            icon={<Eye className="h-[18px] w-[18px]" />}
            active={tab === "Preview"}
            onClick={() => setTab("Preview")}
          />
          <MobileTabBtn
            label={t("workspace.mobile.edit") ?? t("workspace.tab.edit")}
            icon={<Edit3 className="h-[18px] w-[18px]" />}
            active={tab === "Edit"}
            onClick={() => setTab("Edit")}
          />
        </nav>
      </div>
    )
  }

  /* ─── Desktop layout ─── */
  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      {/* Left sidebar */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-white/8">
        {/* Sidebar header */}
        <header className="flex shrink-0 items-center justify-between px-3 py-2 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#c15f3c]" />
            <span className="text-xs font-semibold tracking-widest uppercase text-foreground/50 select-none">
              Builder
            </span>
          </div>

          <div className="flex gap-0.5 rounded-md bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setTab("Generate")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                tab === "Generate"
                  ? "bg-[#c15f3c] text-white shadow-sm"
                  : "text-foreground/45 hover:text-foreground/75"
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              {t("workspace.tab.generate")}
            </button>
            <button
              type="button"
              onClick={() => setTab("Edit")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                tab === "Edit"
                  ? "bg-[#c15f3c] text-white shadow-sm"
                  : "text-foreground/45 hover:text-foreground/75"
              }`}
            >
              <Edit3 className="h-3 w-3" />
              {t("workspace.tab.edit")}
            </button>
          </div>
        </header>

        {/* Sidebar content — both chat and edit kept mounted for instant switch */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <PanelHost active={tab === "Generate"}>
            <div className="flex h-full flex-col overflow-auto">{children.chat}</div>
          </PanelHost>
          <PanelHost active={tab === "Edit"}>
            <div className="flex h-full flex-col overflow-auto">{children.edit}</div>
          </PanelHost>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children.preview}</div>
    </div>
  )
}

/**
 * PanelHost — keeps a panel mounted but visually hidden when inactive.
 * Critical: hidden panels keep their state (chat messages, scroll position,
 * iframe contents, etc.) instead of unmounting and losing it.
 */
function PanelHost({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 ${active ? "" : "pointer-events-none"}`}
      style={{ visibility: active ? "visible" : "hidden" }}
    >
      {children}
    </div>
  )
}

function MobileTabBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[10px] font-medium transition-colors active:bg-white/5 ${
        active ? "text-[#c15f3c]" : "text-foreground/50 hover:text-foreground/80"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
