import { redirect } from "next/navigation";

// A raiz apenas redireciona; o middleware decide login vs dashboard.
export default function Home() {
  redirect("/dashboard");
}
