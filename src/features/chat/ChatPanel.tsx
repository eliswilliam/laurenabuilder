"use client";

import { ChatMessageList } from "@/features/chat/ChatMessageList";
import { PromptInput } from "@/components/PromptInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useChatPanel } from "./useChatPanel";
import { ClarifyPanel } from "./ClarifyPanel";
import React from "react";
import { useI18n } from "@/i18n/provider";

type Props = { initialMessages: import("@/actions/chat-conversations").Message[] };

export function ChatPanel({ initialMessages }: Props) {
  const chat = useChatPanel(initialMessages);
  const { t } = useI18n();

  return (
    <>
      <div className="flex flex-col h-full gap-2">
        <ChatMessageList
          messages={chat.messages}
          isBotThinking={chat.isBotThinking}
          sessionLoading={false}
          status={chat.status}
        />

        {chat.clarifyData && (
          <ClarifyPanel
            data={chat.clarifyData}
            onSubmit={chat.submitWithOptions}
            disabled={chat.isLoading}
          />
        )}

        {!chat.clarifyData && (
          <PromptInput
            onSendMessage={({ content: { text, image } }) => {
              chat.send(image, text);
            }}
            generating={chat.isLoading}
            onError={chat.clearError}
            input={chat.input}
            handleInputChange={chat.handleInputChange}
            setInput={chat.setInput}
            stop={chat.stop}
            onAttachments={chat.setAttachments}
          />
        )}

        {chat.error && <p className="text-red-500 mt-2">{chat.error}</p>}
      </div>

      <Dialog open={chat.creditModalOpen} onOpenChange={chat.closeCreditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.credit.title")}</DialogTitle>
            <DialogDescription>
              {t("chat.credit.desc")}
            </DialogDescription>
            <DialogDescription>{t("chat.credit.price")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button
              size="lg"
              onClick={() =>
                window.open(
                  "https://buy.stripe.com/7sI9Bi6wP9O13NScMO",
                  "_blank"
                )
              }
            >
              {t("chat.credit.purchase")}
            </Button>
          </div>
          <DialogFooter>
            <div className="text-xs text-muted-foreground">
              {t("chat.credit.payments")}
            </div>
            <Button variant="ghost" onClick={chat.closeCreditModal}>
              {t("chat.credit.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}