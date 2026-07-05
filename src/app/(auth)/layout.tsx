import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="h-6 w-6" />
        </div>
        <span className="text-xl font-bold">Meu Cofre</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
