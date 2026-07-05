import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description: string;
  /** O que este módulo vai entregar (bullets). */
  features?: string[];
}

/** Placeholder de módulo ainda não implementado (Etapa 1 = só a fundação). */
export function ModulePlaceholder({ title, description, features }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Construction className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Módulo em construção</p>
            <p className="text-sm text-muted-foreground">
              A fundação (banco, auth, layout) está pronta. Este módulo entra nas próximas etapas.
            </p>
          </div>
          {features && features.length > 0 && (
            <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-muted-foreground">
              {features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
