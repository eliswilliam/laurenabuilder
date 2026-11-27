import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./chatStore";
import type { Message as CustomMessage } from "@/actions/chat-conversations";

function reset() {
  useChatStore.setState({ byId: {} });
}

const userMsg = (id: string, content = "hi"): CustomMessage => ({
  id,
  role: "user",
  content,
  createdAt: new Date().toISOString(),
});

describe("chatStore", () => {
  beforeEach(reset);

  it("ensure() seeds initial messages once and ignores subsequent calls", () => {
    const { ensure } = useChatStore.getState();
    ensure("conv-1", [userMsg("m1", "first")]);
    ensure("conv-1", [userMsg("m2", "second")]); // should NOT replace

    const conv = useChatStore.getState().byId["conv-1"];
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].id).toBe("m1");
    expect(conv.initialized).toBe(true);
  });

  it("ensure() generates ids and timestamps for messages missing them", () => {
    const { ensure } = useChatStore.getState();
    const noId = { role: "user", content: "x" } as CustomMessage;
    ensure("conv-1", [noId]);
    const m = useChatStore.getState().byId["conv-1"].messages[0];
    expect(m.id).toBeTruthy();
    expect(m.createdAt).toBeTruthy();
  });

  it("appendMessage() adds a message to the targeted conversation only", () => {
    const { ensure, appendMessage } = useChatStore.getState();
    ensure("a", []);
    ensure("b", []);
    appendMessage("a", userMsg("m1"));
    expect(useChatStore.getState().byId.a.messages).toHaveLength(1);
    expect(useChatStore.getState().byId.b.messages).toHaveLength(0);
  });

  it("updateAssistantContent() patches only the matching message id", () => {
    const { ensure, appendMessage, updateAssistantContent } = useChatStore.getState();
    ensure("a", []);
    appendMessage("a", { id: "u1", role: "user", content: "hello" });
    appendMessage("a", { id: "a1", role: "assistant", content: "" });
    updateAssistantContent("a", "a1", (prev) => prev + "world");
    updateAssistantContent("a", "a1", (prev) => prev + "!");

    const messages = useChatStore.getState().byId.a.messages;
    expect(messages[0].content).toBe("hello");
    expect(messages[1].content).toBe("world!");
  });

  it("setInput / setStatus / setError / setClarifyData are isolated by conversation id", () => {
    const { setInput, setStatus, setError, setClarifyData } = useChatStore.getState();
    setInput("a", "draft a");
    setInput("b", "draft b");
    setStatus("a", "streaming");
    setError("b", "boom");
    setClarifyData("a", { questions: [] } as any);

    const state = useChatStore.getState().byId;
    expect(state.a.input).toBe("draft a");
    expect(state.b.input).toBe("draft b");
    expect(state.a.status).toBe("streaming");
    expect(state.b.status).toBe("idle");
    expect(state.a.error).toBeNull();
    expect(state.b.error).toBe("boom");
    expect(state.a.clarifyData).toEqual({ questions: [] });
  });

  it("state survives an emulated component remount (same key)", () => {
    // Component A mounts: ensure runs, messages stream in
    const { ensure, appendMessage } = useChatStore.getState();
    ensure("conv", [userMsg("m1", "hello")]);
    appendMessage("conv", { id: "a1", role: "assistant", content: "world" });

    // Component A unmounts (no-op for the store) and remounts later.
    // Calling ensure with the SAME key should NOT clear prior messages.
    ensure("conv", [userMsg("m99", "stale-initial")]);

    const messages = useChatStore.getState().byId.conv.messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe("m1");
    expect(messages[1].id).toBe("a1");
  });

  it("resetConversation() removes a single conversation without affecting others", () => {
    const { ensure, resetConversation } = useChatStore.getState();
    ensure("a", [userMsg("m1")]);
    ensure("b", [userMsg("m2")]);
    resetConversation("a");
    expect(useChatStore.getState().byId.a).toBeUndefined();
    expect(useChatStore.getState().byId.b).toBeDefined();
  });
});
