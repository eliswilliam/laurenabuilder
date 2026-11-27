import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { Layout, type WorkspaceTab } from "./WorkspaceLayout";

// Mock the i18n provider so tests don't need the real i18n setup.
vi.mock("@/i18n/provider", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "workspace.mobile.chat": "Chat",
        "workspace.mobile.preview": "Preview",
        "workspace.mobile.edit": "Edit",
        "workspace.tab.generate": "Generate",
        "workspace.tab.edit": "Edit",
      };
      return map[key] ?? key;
    },
  }),
}));

/**
 * Helper component that hosts state-bearing panels and exposes a stateful
 * counter inside the Chat panel so we can verify the panel is NOT remounted
 * (which would reset its internal state) when the tab changes.
 */
function StatefulChatPanel() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="chat-count">{count}</span>
      <button data-testid="chat-bump" onClick={() => setCount((c) => c + 1)}>
        bump
      </button>
    </div>
  );
}

function Harness({
  isMobile,
  initialTab = "Generate",
}: {
  isMobile: boolean;
  initialTab?: WorkspaceTab;
}) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  return (
    <Layout isMobile={isMobile} tab={tab} setTab={setTab}>
      {{
        chat: <StatefulChatPanel />,
        edit: <div data-testid="edit-panel">edit content</div>,
        preview: <div data-testid="preview-panel">preview content</div>,
      }}
    </Layout>
  );
}

describe("WorkspaceLayout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("desktop", () => {
    it("renders both chat and edit but only one is visible", () => {
      render(<Harness isMobile={false} />);
      // Both panels mounted — desktop has chat + edit in the sidebar
      expect(screen.getByTestId("chat-count")).toBeInTheDocument();
      expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
    });

    it("preserves chat panel state when switching to Edit tab and back", async () => {
      const user = userEvent.setup();
      render(<Harness isMobile={false} />);

      await user.click(screen.getByTestId("chat-bump"));
      await user.click(screen.getByTestId("chat-bump"));
      expect(screen.getByTestId("chat-count").textContent).toBe("2");

      // Find the Edit button in the desktop tab switcher (not the panel)
      const editTab = screen.getAllByRole("button").find((b) => b.textContent === "Edit");
      expect(editTab).toBeDefined();
      await act(async () => {
        await user.click(editTab!);
      });

      const generateTab = screen
        .getAllByRole("button")
        .find((b) => b.textContent === "Generate");
      await act(async () => {
        await user.click(generateTab!);
      });

      // Chat state survived the round-trip
      expect(screen.getByTestId("chat-count").textContent).toBe("2");
    });
  });

  describe("mobile", () => {
    it("renders all three panels (mounted, just hidden when inactive)", () => {
      render(<Harness isMobile={true} />);
      expect(screen.getByTestId("chat-count")).toBeInTheDocument();
      expect(screen.getByTestId("edit-panel")).toBeInTheDocument();
      expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
    });

    it("shows three tab buttons in the bottom nav", () => {
      render(<Harness isMobile={true} />);
      expect(screen.getByRole("button", { name: /Chat/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Preview/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });

    it("preserves chat state when navigating Chat → Preview → Edit → Chat", async () => {
      const user = userEvent.setup();
      render(<Harness isMobile={true} />);

      // Bump count three times while on Chat tab
      await user.click(screen.getByTestId("chat-bump"));
      await user.click(screen.getByTestId("chat-bump"));
      await user.click(screen.getByTestId("chat-bump"));
      expect(screen.getByTestId("chat-count").textContent).toBe("3");

      // Navigate Chat → Preview → Edit → Chat
      await user.click(screen.getByRole("button", { name: /Preview/i }));
      await user.click(screen.getByRole("button", { name: /Edit/i }));
      await user.click(screen.getByRole("button", { name: /Chat/i }));

      // CRITICAL: the count must still be 3 — proving the chat panel
      // was never unmounted across tab changes (the original bug).
      expect(screen.getByTestId("chat-count").textContent).toBe("3");
    });

    it("hides inactive panels via visibility (not removal) — they remain in the DOM", () => {
      render(<Harness isMobile={true} initialTab="Preview" />);

      // All three panels should still be present in the DOM
      const chatCount = screen.getByTestId("chat-count");
      const editPanel = screen.getByTestId("edit-panel");
      const previewPanel = screen.getByTestId("preview-panel");

      expect(chatCount).toBeInTheDocument();
      expect(editPanel).toBeInTheDocument();
      expect(previewPanel).toBeInTheDocument();
    });
  });
});
