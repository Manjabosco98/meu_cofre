import { redirect } from "next/navigation";

// App single-user: cadastro público desativado. O usuário é criado pelo administrador.
export default function CadastroPage() {
  redirect("/login");
}
