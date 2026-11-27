"use client";

import { create } from "zustand";
import type { Message as CustomMessage } from "@/actions/chat-conversations";
import type { ClarifyData } from "./responseProcessor";

type ChatStatus = "idle" | "submitting" | "submitted" | "streaming";

interface ConversationState {
  messages: CustomMessage[];
  input: string;
  status: ChatStatus;
  error: string | null;
  clarifyData: ClarifyData | null;
  pendingPrompt: string;
  initialized: boolean;
}

interface ChatStore {
  byId: Record<string, ConversationState>;

  ensure: (id: string, initialMessages: CustomMessage[]) => void;
  setMessages: (
    id: string,
    updater: (prev: CustomMessage[]) => CustomMessage[]
  ) => void;
  appendMessage: (id: string, message: CustomMessage) => void;
  updateAssistantContent: (
    id: string,
    assistantId: string,
    updater: (prev: string) => string
  ) => void;
  setInput: (id: string, input: string) => void;
  setStatus: (id: string, status: ChatStatus) => void;
  setError: (id: string, error: string | null) => void;
  setClarifyData: (id: string, data: ClarifyData | null) => void;
  setPendingPrompt: (id: string, prompt: string) => void;
  resetConversation: (id: string) => void;
}

const EMPTY_STATE: ConversationState = {
  messages: [],
  input: "",
  status: "idle",
  error: null,
  clarifyData: null,
  pendingPrompt: "",
  initialized: false,
};

function withConversation(
  state: ChatStore,
  id: string,
  patch: Partial<ConversationState> | ((prev: ConversationState) => Partial<ConversationState>)
): ChatStore["byId"] {
  const prev = state.byId[id] ?? EMPTY_STATE;
  const update = typeof patch === "function" ? patch(prev) : patch;
  return { ...state.byId, [id]: { ...prev, ...update } };
}

export const useChatStore = create<ChatStore>((set) => ({
  byId: {},

  ensure: (id, initialMessages) =>
    set((state) => {
      const existing = state.byId[id];
      if (existing && existing.initialized) return state;

      const seeded: CustomMessage[] = initialMessages.map((m) => ({
        ...m,
        id: m.id || (typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
        createdAt: m.createdAt || new Date().toISOString(),
      }));

      return {
        byId: {
          ...state.byId,
          [id]: { ...EMPTY_STATE, messages: seeded, initialized: true },
        },
      };
    }),

  setMessages: (id, updater) =>
    set((state) => ({
      byId: withConversation(state, id, (prev) => ({
        messages: updater(prev.messages),
      })),
    })),

  appendMessage: (id, message) =>
    set((state) => ({
      byId: withConversation(state, id, (prev) => ({
        messages: [...prev.messages, message],
      })),
    })),

  updateAssistantContent: (id, assistantId, updater) =>
    set((state) => ({
      byId: withConversation(state, id, (prev) => ({
        messages: prev.messages.map((msg) => {
          if (msg.id !== assistantId) return msg;
          const current = typeof msg.content === "string" ? msg.content : "";
          return { ...msg, content: updater(current) };
        }),
      })),
    })),

  setInput: (id, input) =>
    set((state) => ({ byId: withConversation(state, id, { input }) })),

  setStatus: (id, status) =>
    set((state) => ({ byId: withConversation(state, id, { status }) })),

  setError: (id, error) =>
    set((state) => ({ byId: withConversation(state, id, { error }) })),

  setClarifyData: (id, clarifyData) =>
    set((state) => ({ byId: withConversation(state, id, { clarifyData }) })),

  setPendingPrompt: (id, pendingPrompt) =>
    set((state) => ({ byId: withConversation(state, id, { pendingPrompt }) })),

  resetConversation: (id) =>
    set((state) => {
      const { [id]: _omit, ...rest } = state.byId;
      void _omit;
      return { byId: rest };
    }),
}));

export function selectConversation(id: string | null | undefined): ConversationState {
  if (!id) return EMPTY_STATE;
  const state = useChatStore.getState().byId[id];
  return state ?? EMPTY_STATE;
}

export type { ConversationState, ChatStatus };
