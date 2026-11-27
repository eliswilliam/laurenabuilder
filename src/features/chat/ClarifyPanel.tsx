"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { ClarifyData } from "./responseProcessor";

interface Props {
  data: ClarifyData;
  onSubmit: (selected: Record<string, string>) => void;
  disabled?: boolean;
}

export function ClarifyPanel({ data, onSubmit, disabled = false }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});

  const toggle = (id: string, option: string) => {
    if (disabled) return;
    setSelected((prev) => ({
      ...prev,
      [id]: prev[id] === option ? "" : option,
    }));
  };

  const canSubmit =
    !disabled && data.questions.every((q) => Boolean(selected[q.id]));

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(selected);
  };

  return (
    <div className="mx-1 mb-2 rounded-xl border border-white/10 bg-neutral-900 p-4 space-y-4">
      {data.question && (
        <p className="text-sm text-neutral-300">{data.question}</p>
      )}

      {data.questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            {q.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const isSelected = selected[q.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(q.id, opt)}
                  disabled={disabled}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
                    isSelected
                      ? "bg-[#c15f3c] border-[#c15f3c] text-white shadow-sm"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white"
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          "w-full mt-2 py-2 rounded-lg text-sm font-semibold transition-all duration-150",
          canSubmit
            ? "bg-[#c15f3c] text-white hover:bg-[#a84f30] cursor-pointer"
            : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
        )}
      >
        Gerar site →
      </button>
    </div>
  );
}
