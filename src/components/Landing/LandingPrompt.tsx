"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { PromptInput } from "@/components/PromptInput"
import { useI18n } from "@/i18n/provider"

export function LandingPrompt() {
  const router = useRouter()
  const { data: session } = useSession()
  const { t } = useI18n()
  const [generating, setGenerating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")

  const planActive = (session?.user as { planActive?: boolean } | null)?.planActive ?? false

  const handleSendMessage = async (message: any) => {
    setError(null)
    setGenerating(true)
    try {
      const id = crypto.randomUUID()
      // Save the prompt so the chat page can pick it up after auth redirect
      localStorage.setItem(
        'chatToProcess',
        JSON.stringify({ id, message: message.content.text, image: message.content.image, timestamp: Date.now() })
      )
      const destination = `/chat/${id}`
      if (!session) {
        // Not authenticated → go through OAuth flow, return to chat after
        router.push(`/auth/login?return_to=${encodeURIComponent(destination)}`)
      } else if (!planActive) {
        // Authenticated but no active subscription → send to pricing page on main domain
        const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "https://laurenastudio.pro"
        window.location.href = `${mainDomain}/escolher-plano`
      } else {
        router.push(destination)
      }
    } catch (err: any) {
      console.error('Failed to create chat:', err)
      setError(err.message || t("landing.error.createChatFailed"))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <PromptInput
        height={80}
        onSendMessage={handleSendMessage}
        input={prompt}
        setInput={setPrompt}
        handleInputChange={e => setPrompt(e.target.value)}
        generating={generating}
        onError={(e) => setError(e)}
      />
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </>
  )
}
