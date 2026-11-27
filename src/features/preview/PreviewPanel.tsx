"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { PreviewToolbar } from "./PreviewToolbar";
import { IframePreview } from "./IframePreview";
import { useIframePreview } from "./useIframePreview";
import { useI18n } from "@/i18n/provider";

interface Props {
  files: Record<string, string>;
  previewError: string | null;
  generating: boolean;
  onError: (e: string | null) => void;
  onFix: () => void;
  previewRef?: React.RefObject<any>;
}

export function PreviewPanel({ files, previewError, generating, onError, onFix, previewRef }: Props) {
  const { t } = useI18n();
  const { loading, iframeSrc, refresh, iframeRef } = useIframePreview(files, { onError, previewRef });
  const [host, setHost] = React.useState("");

  React.useEffect(() => {
    setHost(window.location.host);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex-col p-2 sm:p-4">
      {previewError && (
        <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 sm:p-3">
          <p className="text-red-500 text-xs sm:text-sm mb-2 break-words">{previewError}</p>
          <Button onClick={onFix} disabled={generating} size="sm" className="w-full sm:w-auto">
            {t("preview.fix")}
          </Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border">
        <PreviewToolbar host={host} onRefresh={refresh} />
        <IframePreview ref={previewRef as any} src={iframeSrc} loading={loading} iframeRef={iframeRef} />
      </div>
    </div>
  );
}
