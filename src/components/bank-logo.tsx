import { Icon } from "@/components/lucide-icon";
import { bankBySlug } from "@/lib/banks";
import { cn } from "@/lib/utils";

interface Props {
  /** Slug do banco (ou texto livre / "Outro" → fallback). */
  bank: string | null | undefined;
  /** Cor do fallback quando não há logo (ex.: cor da conta). */
  color?: string;
  /** Ícone do fallback (nome lucide). Default: "landmark" (ícone genérico de banco). */
  fallbackIcon?: string;
  /** Tamanho/rounding do badge (default h-10 w-10). */
  className?: string;
}

/**
 * Badge com a logo oficial do banco sobre fundo branco (contrasta em tema claro e
 * escuro). Sem logo mapeada (ou "Outro") cai no ícone colorido — o card nunca fica
 * sem ícone. Logos são SVGs estáticos locais, sem rede em runtime.
 */
export function BankLogo({ bank, color, fallbackIcon, className }: Props) {
  const b = bankBySlug(bank);
  const box = cn("flex shrink-0 items-center justify-center rounded-lg", className ?? "h-10 w-10");

  if (b) {
    return (
      <span className={cn(box, "overflow-hidden bg-white ring-1 ring-black/10")}>
        {/* SVG estático em /public/banks — servido como arquivo, sem chamada externa. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.logo} alt={b.nome} className="h-[68%] w-[68%] object-contain" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={cn(box, "text-white")} style={{ backgroundColor: color || "#64748b" }}>
      <Icon name={fallbackIcon ?? "landmark"} className="h-1/2 w-1/2" />
    </span>
  );
}
