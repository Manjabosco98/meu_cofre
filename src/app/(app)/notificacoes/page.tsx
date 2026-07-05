import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { fetchNotificationsPageData } from "@/lib/query-fns";
import { NotificationsView, type NotificationRow } from "@/components/notifications/notifications-view";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const qc = makeQueryClient();
  const data = await qc.fetchQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotificationsPageData,
  });

  return (
    <ServerHydration qc={qc}>
      <NotificationsView notifications={(data.notifications as NotificationRow[])} />
    </ServerHydration>
  );
}
