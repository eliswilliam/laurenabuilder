/**
 * Route group (workspace) — layout partagé par /chat/** et /publicar.
 * FileManagerProvider est monté ici (et ici seulement) pour que l'état VFS
 * persiste lors de la navigation entre /chat/[id] et /publicar sans polluer
 * les autres routes (auth, landing) avec le scaffold de 168 KB.
 */
import { FileManagerProvider } from "@/vfs";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <FileManagerProvider>{children}</FileManagerProvider>;
}
