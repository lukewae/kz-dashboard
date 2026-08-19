import { Shell } from "@/components/Shell";
import { ServersBrowser } from "@/components/ServersBrowser";
import { cs2kzProvider } from "@/lib/providers/cs2kz";

export const revalidate = 30;

export default async function ServersPage() {
  const servers = await cs2kzProvider.getServers();

  return (
    <Shell>
      <div className="page-eyebrow">GLOBAL NETWORK // SERVERS</div>
      <h1 className="page-title">Global CKZ Servers</h1>

      <ServersBrowser initialServers={servers} />
    </Shell>
  );
}
