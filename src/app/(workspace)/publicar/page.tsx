"use client"

import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useFileManager } from "@/vfs"
import { bundleReactFilesIntoIframe } from "@/bundler"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n/provider"

// ── Slug security — mirrors backend dns_service.py RESERVED_SLUGS ────────────
const RESERVED_SLUGS = new Set([
  'www', 'mail', 'smtp', 'pop', 'pop3', 'imap', 'ftp', 'sftp',
  'ns', 'ns1', 'ns2', 'ns3', 'ns4',
  'vpn', 'ssh', 'proxy', 'gateway',
  'api', 'api-v1', 'api-v2', 'app', 'apps',
  'admin', 'administrator', 'dashboard', 'panel', 'portal',
  'builder', 'editor', 'preview', 'publish',
  'dev', 'development', 'staging', 'stage', 'test', 'testing', 'beta', 'alpha', 'demo', 'sandbox',
  'static', 'cdn', 'assets', 'asset', 'media', 'img', 'images', 'files',
  'docs', 'documentation', 'help', 'support', 'faq', 'status', 'health', 'ping',
  'blog', 'news', 'shop', 'store', 'cart', 'pay', 'payment', 'payments', 'billing', 'checkout',
  'auth', 'login', 'logout', 'signup', 'register', 'account', 'oauth', 'sso', 'id', 'callback',
  'monitor', 'monitoring', 'metrics', 'grafana', 'kibana', 'logs',
  'internal', 'intranet', 'private', 'secure', 'corp', 'localhost', 'local',
  'laurenastudio', 'laurena', 'studio',
  'webhook', 'webhooks',
  'root', 'system', 'server',
])

function slugValid(s: string): boolean {
  const n = s.trim().toLowerCase()
  if (!n || n.length > 63) return false
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(n)
}

function slugReserved(s: string): boolean {
  return RESERVED_SLUGS.has(s.trim().toLowerCase())
}

type SlugError = "reserved" | "invalid" | null

function getSlugError(s: string): SlugError {
  const n = s.trim().toLowerCase()
  if (!n) return null
  if (slugReserved(n)) return "reserved"
  if (!slugValid(n)) return "invalid"
  return null
}

type PublishStatus = "idle" | "bundling" | "uploading" | "polling" | "success" | "error"

export default function PublicarPage() {
  const { files } = useFileManager()
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const projectId = (searchParams.get("projectId") || "").trim()
  const [slug, setSlug] = useState("")
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle")
  const [siteUrl, setSiteUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const pollJob = useCallback((jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/publish/jobs/${jobId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === "success") {
          clearInterval(interval)
          setSiteUrl(data.result?.siteUrl ?? data.result?.site_url ?? null)
          setPublishStatus("success")
        } else if (data.status === "failed" || data.status === "error") {
          clearInterval(interval)
          setErrorMsg(data.error ?? t("publish.error.failed"))
          setPublishStatus("error")
        }
      } catch { /* erreur transitoire → continuer */ }
    }, 3000)

    // Timeout 10 min
    setTimeout(() => {
      clearInterval(interval)
      setPublishStatus((s) => {
        if (s === "polling") {
          setErrorMsg(t("publish.error.timeout"))
          return "error"
        }
        return s
      })
    }, 600_000)
  }, [])

  const handlePublish = async () => {
    // Validate slug before anything else
    const slugErr = getSlugError(slug)
    if (slugErr === "reserved") {
      setErrorMsg(t("publish.error.slugReserved"))
      setPublishStatus("error")
      return
    }
    if (slugErr === "invalid") {
      setErrorMsg(t("publish.error.slugInvalid"))
      setPublishStatus("error")
      return
    }

    setPublishStatus("bundling")
    setErrorMsg(null)
    setSiteUrl(null)

    // ── 1. Bundler les fichiers VFS → HTML complet ────────────────────────
    let htmlContent: string
    try {
      const blob = await bundleReactFilesIntoIframe({ files, forceRefresh: true, isProduction: true })
      htmlContent = await blob.text()
    } catch (err) {
      setErrorMsg(
        t("publish.error.compile", {
          details: err instanceof Error ? err.message : String(err),
        })
      )
      setPublishStatus("error")
      return
    }

    // ── 2. Envoyer le HTML compilé au backend ─────────────────────────────
    setPublishStatus("uploading")
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Un seul fichier index.html — le worker Python sait le découper
          files: [{ path: "index.html", content: htmlContent }],
          ...(projectId ? { projectId } : {}),
          ...(slug.trim() ? { slug: slug.trim() } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.detail ?? data.error ?? t("publish.error.generic"))
        setPublishStatus("error")
        return
      }

      setPublishStatus("polling")
      pollJob(data.jobId)
    } catch {
      setErrorMsg(t("publish.error.network"))
      setPublishStatus("error")
    }
  }

  const isRunning = ["bundling", "uploading", "polling"].includes(publishStatus)

  const buttonLabel = {
    idle: t("publish.button.idle"),
    bundling: t("publish.button.bundling"),
    uploading: t("publish.button.uploading"),
    polling: t("publish.button.polling"),
    success: t("publish.button.success"),
    error: t("publish.button.error"),
  }[publishStatus]

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("publish.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("publish.subtitle")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">{t("publish.slugLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="slug"
              placeholder={t("publish.slugPlaceholder")}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              disabled={isRunning}
              className="flex-1"
            />
            <span className="text-muted-foreground text-sm whitespace-nowrap">.laurenastudio.pro</span>
          </div>
          {slug && (() => {
            const err = getSlugError(slug)
            if (err === "reserved")
              return <p className="text-xs text-destructive">{t("publish.error.slugReserved")}</p>
            if (err === "invalid")
              return <p className="text-xs text-destructive">{t("publish.error.slugInvalid")}</p>
            return <p className="text-xs text-green-600">https://{slug.trim().toLowerCase()}.laurenastudio.pro</p>
          })()}
        </div>

        <Button onClick={handlePublish} disabled={isRunning} className="w-full" size="lg">
          {isRunning && (
            <span className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          )}
          {buttonLabel}
        </Button>

        {publishStatus === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 space-y-1">
            <p className="font-medium text-green-800 dark:text-green-300 text-sm">{t("publish.success.title")}</p>
            {siteUrl ? (
              <a href={siteUrl} target="_blank" rel="noopener noreferrer"
                className="text-green-700 dark:text-green-400 underline text-sm break-all">
                {siteUrl}
              </a>
            ) : (
              <p className="text-green-700 dark:text-green-400 text-sm">
                {t("publish.success.pendingLink")}
              </p>
            )}
          </div>
        )}

        {publishStatus === "error" && errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  )
}
