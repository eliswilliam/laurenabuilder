// features/chat/useChatPanel.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import {
  Message as CustomMessage,
} from "@/actions/chat-conversations";
import { useFileManager } from "@/vfs";
import { processResponse, type ClarifyData } from "./responseProcessor";
import { useChatStore } from "./chatStore";

const ANONYMOUS_CONVERSATION_KEY = "__anonymous__";

export interface UseChatPanel {
  messages: CustomMessage[];
  input: string;
  status: "idle" | "submitting" | "submitted" | "streaming";
  isBotThinking: boolean;
  isLoading: boolean;
  credits: number;
  error: string | null;
  attachments: FileList | undefined;
  clarifyData: ClarifyData | null;

  /* actions */
  setInput: (t: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  send: (imageUrl?: string, textOverride?: string) => Promise<void>;
  submitWithOptions: (selected: Record<string, string>) => Promise<void>;
  stop: () => void;
  setAttachments: (f: FileList | undefined) => void;
  clearError: () => void;
  closeCreditModal: () => void;
  creditModalOpen: boolean;
}

export function useChatPanel(initialMessages: CustomMessage[]): UseChatPanel {
  /* params & session ----------------------------------------------------- */
  const params = useParams();
  const conversationId = (params?.id as string | undefined) ?? undefined;
  const storeKey = conversationId ?? ANONYMOUS_CONVERSATION_KEY;

  /* files manager -------------------------------------------------------- */
  const { extractCodebase, createFilesBulk } = useFileManager();

  /* persisted state via zustand ----------------------------------------- */
  const ensure = useChatStore((s) => s.ensure);
  const appendMessageToStore = useChatStore((s) => s.appendMessage);
  const updateAssistantContentInStore = useChatStore((s) => s.updateAssistantContent);
  const setInputInStore = useChatStore((s) => s.setInput);
  const setStatusInStore = useChatStore((s) => s.setStatus);
  const setErrorInStore = useChatStore((s) => s.setError);
  const setClarifyDataInStore = useChatStore((s) => s.setClarifyData);
  const setPendingPromptInStore = useChatStore((s) => s.setPendingPrompt);

  // Hydrate the store with server-provided messages on first mount of this conversation
  useEffect(() => {
    ensure(storeKey, initialMessages);
  }, [storeKey, initialMessages, ensure]);

  const { messages, input, status, error, clarifyData } = useChatStore(
    useShallow((s) => {
      const c = s.byId[storeKey];
      return {
        messages: c?.messages ?? [],
        input: c?.input ?? "",
        status: c?.status ?? "idle",
        error: c?.error ?? null,
        clarifyData: c?.clarifyData ?? null,
      };
    })
  );

  /* local-only state (intentionally not persisted across remount) ------- */
  const [attachments, setAttachments] = useState<FileList | undefined>(undefined);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [credits] = useState(9999);

  const messagesRef = useRef<CustomMessage[]>(messages);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendMessage = useCallback(
    (message: CustomMessage) => {
      const next: CustomMessage = {
        ...message,
        id: message.id || crypto.randomUUID(),
        createdAt: message.createdAt || new Date().toISOString(),
      };
      appendMessageToStore(storeKey, next);
      return next;
    },
    [appendMessageToStore, storeKey]
  );

  const updateAssistantContent = useCallback(
    (assistantId: string, updater: (prev: string) => string) => {
      updateAssistantContentInStore(storeKey, assistantId, updater);
    },
    [updateAssistantContentInStore, storeKey]
  );

  const setInput = useCallback(
    (t: string) => setInputInStore(storeKey, t),
    [setInputInStore, storeKey]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputInStore(storeKey, e.target.value);
    },
    [setInputInStore, storeKey]
  );

  const parseSseEvent = useCallback((rawEvent: string) => {
    const lines = rawEvent.split("\n");
    const dataLines = lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    if (dataLines.length === 0) return null;
    const payload = dataLines.join("\n");

    try {
      return JSON.parse(payload) as {
        type?: string;
        delta?: string;
        error?: string;
        message?: { content?: string };
      };
    } catch {
      return null;
    }
  }, []);

  const send = useCallback(
    async (imageUrl?: string, textOverride?: string, skipClarify = false) => {
      const currentInput = useChatStore.getState().byId[storeKey]?.input ?? "";
      const text = (textOverride ?? currentInput).trim();
      if (!text && !imageUrl) return;

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const userMessage: CustomMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        experimental_attachments: imageUrl
          ? [{ url: imageUrl, contentType: "image/*" }]
          : undefined,
      };

      const assistantMessage: CustomMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      appendMessage(userMessage);
      appendMessage(assistantMessage);

      setInputInStore(storeKey, "");
      setAttachments(undefined);
      setErrorInStore(storeKey, null);
      setStatusInStore(storeKey, "submitting");

      const controller = new AbortController();
      abortRef.current = controller;

      const payload = {
        id: conversationId,
        messages: [...messagesRef.current, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        codebaseInfo: extractCodebase(),
        attachments: imageUrl ? [{ url: imageUrl, contentType: "image/*" }] : [],
      };

      try {
        const response = await fetch("/api/generate-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = "Failed to generate response";
          try {
            const body = (await response.json()) as { error?: string };
            message = body.error || message;
          } catch {
            // Keep default message.
          }
          throw new Error(message);
        }

        if (!response.body) {
          throw new Error("Streaming response body is empty");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullAssistant = "";
        let sawDelta = false;
        setStatusInStore(storeKey, "submitted");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let eventEnd = buffer.indexOf("\n\n");

          while (eventEnd !== -1) {
            const rawEvent = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + 2);
            const evt = parseSseEvent(rawEvent);

            if (evt?.type === "text-delta" && typeof evt.delta === "string") {
              if (!sawDelta) {
                setStatusInStore(storeKey, "streaming");
                sawDelta = true;
              }
              fullAssistant += evt.delta;
              updateAssistantContent(assistantMessage.id!, (prev) => prev + evt.delta);
            } else if (evt?.type === "error") {
              throw new Error(evt.error || "An error occurred during streaming");
            } else if (evt?.type === "done") {
              const finalContent = evt.message?.content;
              if (typeof finalContent === "string" && finalContent.length > 0) {
                fullAssistant = finalContent;
                updateAssistantContent(assistantMessage.id!, () => finalContent);
              }
            }

            eventEnd = buffer.indexOf("\n\n");
          }
        }

        if (fullAssistant.trim()) {
          const processed = processResponse(fullAssistant);
          // Always strip the clarify tag from the displayed assistant text — the
          // questions render in <ClarifyPanel>, raw XML must never leak into chat.
          const cleanContent = fullAssistant
            .replace(/<laurenaClarify>[\s\S]*?<\/laurenaClarify>/gi, "")
            .trim();
          if (cleanContent !== fullAssistant.trim()) {
            updateAssistantContent(assistantMessage.id!, () => cleanContent);
          }

          if (!skipClarify && processed.clarifyData) {
            setPendingPromptInStore(storeKey, text);
            setClarifyDataInStore(storeKey, processed.clarifyData);
          } else {
            setClarifyDataInStore(storeKey, null);
            const fileCount = Object.keys(processed.filesToCreate).length;
            if (fileCount > 0) {
              createFilesBulk(processed.filesToCreate);
            } else if (skipClarify && processed.clarifyData) {
              // Model returned a second clarify despite the explicit instruction.
              // Surface a clear error instead of failing silently.
              setErrorInStore(
                storeKey,
                "The generator did not produce a site. Please try again with more details."
              );
            }
          }
        }

        setStatusInStore(storeKey, "idle");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatusInStore(storeKey, "idle");
          return;
        }

        const message = err instanceof Error ? err.message : "An error occurred";
        setErrorInStore(storeKey, message);
        setStatusInStore(storeKey, "idle");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      appendMessage,
      conversationId,
      createFilesBulk,
      extractCodebase,
      parseSseEvent,
      setClarifyDataInStore,
      setErrorInStore,
      setInputInStore,
      setPendingPromptInStore,
      setStatusInStore,
      storeKey,
      updateAssistantContent,
    ]
  );

  const submitWithOptions = useCallback(
    async (selected: Record<string, string>) => {
      const conv = useChatStore.getState().byId[storeKey];
      const base = (conv?.pendingPrompt ?? "").trim();
      const data = conv?.clarifyData;

      // Re-attach question labels to the chosen options so the model receives
      // structured Q&A, not just a flat list of values.
      const answerLines = data?.questions
        ? data.questions
            .map((q) => {
              const a = selected[q.id];
              return a ? `- ${q.label}: ${a}` : null;
            })
            .filter((line): line is string => Boolean(line))
        : Object.values(selected).filter(Boolean).map((v) => `- ${v}`);

      const answersBlock = answerLines.join("\n");

      const enhancedPrompt = base
        ? [
            base,
            "",
            "Clarifications already provided — generate the full website now. Do NOT ask for clarification again.",
            answersBlock,
          ].join("\n")
        : [
            "Build a website based on these answers. Do NOT ask for clarification.",
            answersBlock,
          ].join("\n");

      setClarifyDataInStore(storeKey, null);
      setPendingPromptInStore(storeKey, "");
      await send(undefined, enhancedPrompt, true);
    },
    [send, setClarifyDataInStore, setPendingPromptInStore, storeKey]
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatusInStore(storeKey, "idle");
  }, [setStatusInStore, storeKey]);

  const append = useCallback(
    async (message: { role: "user" | "assistant"; content: string }) => {
      if (message.role !== "user") return;
      await send(undefined, message.content);
    },
    [send]
  );

  /* localStorage bridge -------------------------------------------------- */
  useEffect(() => {
    const handler = () => {
      const raw = localStorage.getItem("chatToProcess");
      if (!raw) return;
      try {
        const { message } = JSON.parse(raw);
        if (message) {
          void append({ role: "user", content: String(message) });
          localStorage.removeItem("chatToProcess");
        }
      } catch {}
    };
    handler();
    window.addEventListener("storage", handler);
    window.addEventListener("localStorageChange", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("localStorageChange", handler);
    };
  }, [append]);

  /* public API ----------------------------------------------------------- */
  return {
    messages,
    input,
    status,
    isBotThinking: status === "submitting" || status === "submitted",
    isLoading: status !== "idle",
    credits,
    error,
    attachments,
    clarifyData,
    setInput,
    handleInputChange,
    send,
    submitWithOptions,
    stop,
    setAttachments,
    clearError: () => setErrorInStore(storeKey, null),
    creditModalOpen,
    closeCreditModal: () => setCreditModalOpen(false),
  };
}
