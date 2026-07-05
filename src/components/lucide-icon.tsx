import {
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, ShoppingBag, Wrench,
  Landmark, CircleDashed, Briefcase, Laptop, TrendingUp, RotateCcw, Gift, PlusCircle,
  Tag, Wallet, CreditCard, PiggyBank, Banknote, Coins, Building2, Bus, Plane, Fuel,
  Dumbbell, Pill, Film, Music, BookOpen, Shirt, Smartphone, Wifi, Zap, Droplet,
  Heart, Coffee, Baby, PawPrint, Bike, Receipt, DollarSign, HandCoins, Target, Star,
  type LucideIcon,
} from "lucide-react";

/** Mapa nome->componente. Usado para renderizar ícones salvos como string. */
export const ICON_MAP: Record<string, LucideIcon> = {
  home: Home, utensils: Utensils, car: Car, "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap, "gamepad-2": Gamepad2, "shopping-bag": ShoppingBag,
  wrench: Wrench, landmark: Landmark, "circle-dashed": CircleDashed, briefcase: Briefcase,
  laptop: Laptop, "trending-up": TrendingUp, "rotate-ccw": RotateCcw, gift: Gift,
  "plus-circle": PlusCircle, tag: Tag, wallet: Wallet, "credit-card": CreditCard,
  "piggy-bank": PiggyBank, banknote: Banknote, coins: Coins, "building-2": Building2,
  bus: Bus, plane: Plane, fuel: Fuel, dumbbell: Dumbbell, pill: Pill, film: Film,
  music: Music, "book-open": BookOpen, shirt: Shirt, smartphone: Smartphone, wifi: Wifi,
  zap: Zap, droplet: Droplet, heart: Heart, coffee: Coffee, baby: Baby, "paw-print": PawPrint,
  bike: Bike, receipt: Receipt, "dollar-sign": DollarSign, "hand-coins": HandCoins,
  target: Target, star: Star,
};

/** Ícones disponíveis para escolha (seletor). */
export const PICKABLE_ICONS = Object.keys(ICON_MAP);

interface Props {
  name: string | null | undefined;
  className?: string;
}

/** Renderiza um ícone lucide pelo nome; cai em Tag se não encontrar. */
export function Icon({ name, className }: Props) {
  const Cmp = (name && ICON_MAP[name]) || Tag;
  return <Cmp className={className} />;
}
