import WorkspaceClient from "@/app/chat/[id]/WorkspaceClient"

// FileManagerProvider est dans le layout (workspace) — partagé avec /publicar
export default function Page() {
  return <WorkspaceClient initialConversation={null} />
}
