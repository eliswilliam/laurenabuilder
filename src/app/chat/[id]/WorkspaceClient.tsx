"use client"

import React, { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useFileManager } from "@/vfs"
import type { ChatConversation } from "@/actions/chat-conversations"
import { toast } from "@/hooks/use-toast"
import { EditingPanel } from "@/features/editor/EditingPanel"
import { ChatPanel } from "@/features/chat/ChatPanel"
import { PreviewPanel } from "@/features/preview/PreviewPanel"

import { useElementSelection } from "@/lib/element-selection-stream"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Layout, type WorkspaceTab } from "@/components/layout/WorkspaceLayout"
import { useI18n } from "@/i18n/provider"

interface ChatPageComponentProps {
  initialConversation: ChatConversation | null
}

// Main chat page component — three panels (chat, preview, edit) on every viewport.
function ChatPageComponent({ initialConversation }: ChatPageComponentProps) {
  const [tab, setTab] = useState<WorkspaceTab>("Generate")
  const { t } = useI18n()
  const isMobile = useIsMobile()
  const params = useParams()
  const router = useRouter()

  const { files, createFilesBulk } = useFileManager() as {
    files: Record<string, string>
    createFilesBulk: (files: Record<string, string>) => Record<string, string>
  }
  const selectedElement = useElementSelection((s) => s.selectedElement)

  const [deployLoading, setDeployLoading] = useState<boolean>(false)
  const conversationId = typeof params.id === "string" ? params.id : null
  const previewRef = useRef<any>(null) as React.RefObject<any>
  const initialMessages = initialConversation?.messages || []
  const [previewError, setPreviewError] = useState<string | null>(null)
  const initialFilesRef = useRef(false)

  const handleFix = () => {
    if (!previewError) return
    localStorage.setItem("chatToProcess", JSON.stringify({ message: previewError }))
    window.dispatchEvent(new Event("localStorageChange"))
    setPreviewError(null)
    setTab("Generate")
  }

  useEffect(() => {
    if (initialConversation?.files && !initialFilesRef.current) {
      createFilesBulk(initialConversation.files)
      initialFilesRef.current = true
    }
  }, [initialConversation, createFilesBulk])

  // When the user taps an element in the preview iframe, jump to the Edit tab.
  useEffect(() => {
    if (selectedElement !== null) {
      setTab("Edit")
    }
  }, [selectedElement])

  const handleDeploy = async () => {
    if (!conversationId) return
    setDeployLoading(true)

    try {
      toast({
        title: t("workspace.toasts.generatingPreviewTitle"),
        description: t("workspace.toasts.generatingPreviewDesc"),
        variant: "default" as const,
      })

      const previewIframe = previewRef.current
      if (!previewIframe) {
        throw new Error(t("workspace.errors.previewNotAvailable"))
      }

      const bundledHtml = await previewIframe.getBundledHtml()
      if (!bundledHtml) {
        throw new Error(t("workspace.errors.previewFailedGenerate"))
      }

      const blob = new Blob([bundledHtml], { type: "text/html" })
      const previewUrl = URL.createObjectURL(blob)

      toast({
        title: t("workspace.toasts.previewReadyTitle"),
        description: t("workspace.toasts.previewReadyDesc"),
        variant: "default" as const,
      })

      const newTab = window.open(previewUrl, "_blank")
      setTimeout(() => URL.revokeObjectURL(previewUrl), 5_000)
      if (!newTab) {
        const a = document.createElement("a")
        a.href = previewUrl
        a.download = "preview.html"
        a.click()
      }
    } catch (error) {
      console.error("Failed to open preview:", error)
      toast({
        title: t("workspace.toasts.previewFailedTitle"),
        description: error instanceof Error ? error.message : t("workspace.errors.unknown"),
        variant: "destructive" as const,
      })
    } finally {
      setDeployLoading(false)
    }
  }

  const handlePublicar = () => {
    if (conversationId) {
      router.push(`/publicar?projectId=${encodeURIComponent(conversationId)}`)
      return
    }
    router.push("/publicar")
  }

  const previewToolbar = (
    <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/8 bg-background/95 backdrop-blur px-3 py-2">
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handlePublicar}
          className="px-3 py-2 sm:py-1.5 rounded-md text-xs font-semibold bg-[#c15f3c] text-white hover:bg-[#a84f30] active:bg-[#8e3f25] transition-colors min-h-[40px] sm:min-h-0"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {t("workspace.actions.publish")}
        </button>
        <button
          type="button"
          onClick={handleDeploy}
          disabled={!conversationId || deployLoading}
          className="px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium border border-white/15 text-foreground/60 hover:text-foreground hover:border-white/30 transition-all disabled:opacity-35 min-h-[40px] sm:min-h-0"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {deployLoading ? t("workspace.actions.opening") : t("workspace.actions.openPreview")}
        </button>
      </div>
    </header>
  )

  return (
    <Layout isMobile={isMobile} tab={tab} setTab={setTab}>
      {{
        chat: <ChatPanel initialMessages={initialMessages} />,
        edit: (
          <EditingPanel
            conversationId={conversationId}
            previewRef={previewRef}
            setTab={setTab}
          />
        ),
        preview: (
          <>
            {previewToolbar}
            <PreviewPanel
              files={files}
              previewError={previewError}
              generating={false}
              onError={setPreviewError}
              onFix={handleFix}
              previewRef={previewRef}
            />
          </>
        ),
      }}
    </Layout>
  )
}

export default ChatPageComponent
