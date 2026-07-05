"use client";

import * as React from "react";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  /** Valor em centavos. */
  value: number;
  onChange: (cents: number) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

/**
 * Input monetário pt-BR. Digita-se apenas números; o valor é interpretado
 * como centavos (ex.: digitar "123456" => R$ 1.234,56). Sempre inteiro em centavos.
 */
export function MoneyInput({ value, onChange, id, className, placeholder }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    onChange(digits ? parseInt(digits, 10) : 0);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <input
        id={id}
        inputMode="numeric"
        value={formatAmount(value)}
        onChange={handleChange}
        placeholder={placeholder ?? "0,00"}
        className={cn(
          "tabular flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-right text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      />
    </div>
  );
}
