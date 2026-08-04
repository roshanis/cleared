import { linksFor } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import { TabBar } from "./tab-bar";

export async function MobileTabBar() {
  const session = await getSession();
  if (!session) return null;
  return <TabBar links={linksFor(session)} />;
}
