"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { injectWebsiteBuilderNodeHoverStyles } from "./hoverCss";
import { useElementSelection } from "@/lib/element-selection-stream";

export interface IframePreviewHandle {
  navigateLink: (id: string) => void;
  getBundledHtml: () => Promise<string | null>;
}

interface Props {
  src: string | null;
  loading: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

export const IframePreview = forwardRef<IframePreviewHandle, Props>(
  ({ src, loading, iframeRef }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        navigateLink: (id: string) => {
          const iframe = iframeRef.current;
          if (!iframe) {
            console.error("Iframe element not found");
            return;
          }

          const doc = iframe.contentDocument;
          if (!doc) {
            console.error("Could not access iframe content document");
            return;
          }

          const elem = doc.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
          if (elem) {
            let linkEl: HTMLElement | null = null;
            if (elem.tagName.toLowerCase() === "a") {
              linkEl = elem;
            } else {
              linkEl = elem.closest("a");
            }

            if (linkEl) {
              try {
                linkEl.setAttribute("data-allow-navigation", "true");
                linkEl.click();
              } catch (err) {
                console.error("Failed to navigate link inside iframe:", err);
              }
            }
          }
        },
        getBundledHtml: async () => {
          if (!src) return null;
          const res = await fetch(src);
          return res.text();
        },
      }),
      [iframeRef, src]
    );

    const [, setHtml] = useState<string | null>(null);

    useEffect(() => {
      if (!src) return;
      const el = iframeRef.current;
      if (!el) return;

      const onLoad = () => {
        const doc = el.contentDocument;
        if (!doc || !doc.body) return;

        // 1. Inject hover styles
        const style = doc.createElement("style");
        style.textContent = injectWebsiteBuilderNodeHoverStyles;
        doc.head.appendChild(style);

        const setHover = (target: HTMLElement) => {
          target.setAttribute("data-hov", "true");
          const tag = target.tagName.toLowerCase();
          let label = tag;
          if (
            ["div", "section", "header", "footer", "aside", "nav", "main", "article"].includes(tag)
          ) {
            label = "layout";
          } else if (tag.match(/^h[1-6]$/)) {
            label = "heading";
          }
          target.setAttribute("data-tag-label", label);
        };

        const clearHover = (target: HTMLElement) => {
          target.removeAttribute("data-hov");
          target.removeAttribute("data-tag-label");
        };

        const clearAllHover = () => {
          doc.querySelectorAll("[data-hov]").forEach((n) => clearHover(n as HTMLElement));
        };

        // 2. Hover handlers (desktop)
        doc.body.addEventListener("mouseover", (e: MouseEvent) => {
          const target = (e.target as HTMLElement)?.closest("[data-id]") as HTMLElement | null;
          if (!target) return;
          setHover(target);
        });

        doc.body.addEventListener("mouseout", (e: MouseEvent) => {
          const target = (e.target as HTMLElement)?.closest("[data-id]") as HTMLElement | null;
          if (!target) return;
          clearHover(target);
        });

        // 3. Touch start — apply hover styles momentarily so users see feedback
        doc.body.addEventListener(
          "touchstart",
          (e: TouchEvent) => {
            const t = e.target as HTMLElement | null;
            const target = t?.closest("[data-id]") as HTMLElement | null;
            if (!target) return;
            clearAllHover();
            setHover(target);
          },
          { passive: true }
        );

        // Clear hover state when scrolling on touch (cancels stale highlights)
        doc.addEventListener(
          "touchmove",
          () => {
            clearAllHover();
          },
          { passive: true }
        );

        // 4. Prevent navigation on internal links
        doc.body.addEventListener(
          "click",
          (e) => {
            const a = (e.target as HTMLElement).closest("a");
            if (a && !a.hasAttribute("data-allow-navigation")) {
              e.preventDefault();
            }
          },
          true
        );

        // 5. Selection handler — works for both click and tap
        const handleSelect = (e: Event) => {
          const raw = e.target as HTMLElement;
          const target = raw.closest("[data-id]") as HTMLElement | null;
          if (!target) return;

          const id = target.dataset.id!;
          const tag = target.tagName.toLowerCase();
          const content = target.textContent || "";
          const style = getComputedStyle(target);
          const rect = target.getBoundingClientRect();
          const metadata: Record<string, any> = {};

          if (tag === "img") {
            metadata.src = (target as HTMLImageElement).src;
          } else if (tag === "button") {
            const link = target.closest("a");
            if (link) metadata.linkUrl = link.getAttribute("href");
          } else if (tag === "a") {
            metadata.linkUrl = target.getAttribute("href");
          }

          useElementSelection.getState().setSelectedElement({
            id,
            tag,
            content,
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
            style: {
              backgroundColor: style.backgroundColor,
              color: style.color,
            },
            metadata,
          });
        };

        doc.body.addEventListener("click", handleSelect);

        // 6. Save HTML for export
        fetch(src)
          .then((res) => res.text())
          .then((htmlText) => setHtml(htmlText))
          .catch(() => setHtml(null));
      };

      el.addEventListener("load", onLoad);
      return () => el.removeEventListener("load", onLoad);
    }, [src, iframeRef]);

    return (
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="w-8 h-8 border-4 border-t-transparent border-blue-500 rounded-full animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={src ?? "about:blank"}
          sandbox="allow-scripts allow-popups allow-modals"
          className="w-full h-full border-none touch-manipulation"
          style={{ WebkitOverflowScrolling: "touch" }}
        />
      </div>
    );
  }
);

IframePreview.displayName = "IframePreview";
