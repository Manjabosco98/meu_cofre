import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  CreditCard,
  CalendarClock,
  PiggyBank,
  Target,
  TrendingUp,
  Landmark,
  LineChart,
  FileBarChart,
  Upload,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "Geral" | "Planejamento" | "Análise" | "Sistema";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Geral" },
  { href: "/contas", label: "Contas", icon: Wallet, group: "Geral" },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight, group: "Geral" },
  { href: "/categorias", label: "Categorias e tags", icon: Tags, group: "Geral" },
  { href: "/cartoes", label: "Cartões e faturas", icon: CreditCard, group: "Geral" },
  { href: "/agenda", label: "A pagar / receber", icon: CalendarClock, group: "Planejamento" },
  { href: "/orcamentos", label: "Orçamentos", icon: PiggyBank, group: "Planejamento" },
  { href: "/metas", label: "Metas", icon: Target, group: "Planejamento" },
  { href: "/fluxo-caixa", label: "Fluxo de caixa", icon: LineChart, group: "Análise" },
  { href: "/patrimonio", label: "Patrimônio", icon: Landmark, group: "Análise" },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp, group: "Análise" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, group: "Análise" },
  { href: "/importar", label: "Importar / conciliar", icon: Upload, group: "Sistema" },
  { href: "/notificacoes", label: "Notificações", icon: Bell, group: "Sistema" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, group: "Sistema" },
];

export const NAV_GROUPS = ["Geral", "Planejamento", "Análise", "Sistema"] as const;
