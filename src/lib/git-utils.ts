/**
 * src/lib/git-utils.ts
 * Utilitaires VFS ↔ Prisma (File model en MongoDB).
 *
 * Ces fonctions chargent et sauvegardent les fichiers d'un projet builder
 * depuis/vers la table File de MongoDB via Prisma.
 *
 * Le nom « git » est un vestige historique — l'implémentation actuelle
 * n'utilise pas isomorphic-git mais directement Prisma.
 */

import { prisma } from "@/lib/prisma";

/**
 * Charge tous les fichiers d'un projet depuis MongoDB.
 * Retourne un Record<chemin, contenu>.
 */
export async function gitSnapshotToVfs(
  projectId: string
): Promise<Record<string, string>> {
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { path: true, content: true },
  });

  const result: Record<string, string> = {};
  for (const f of files) {
    result[f.path] = f.content;
  }
  return result;
}

/**
 * Sauvegarde les fichiers VFS dans MongoDB (upsert par projectId + path).
 * Les fichiers absents du nouvel état sont supprimés.
 */
export async function vfsToGitSnapshot(
  projectId: string,
  files: Record<string, string>
): Promise<void> {
  const paths = Object.keys(files);

  // Upsert chaque fichier (create ou update selon (projectId, path))
  await Promise.all(
    paths.map((path) =>
      prisma.file.upsert({
        where: {
          projectId_path: { projectId, path },
        },
        create: {
          projectId,
          path,
          content: files[path],
        },
        update: {
          content: files[path],
        },
      })
    )
  );

  // Supprimer les fichiers qui ne sont plus dans le VFS
  if (paths.length > 0) {
    await prisma.file.deleteMany({
      where: {
        projectId,
        path: { notIn: paths },
      },
    });
  } else {
    // VFS vide : supprimer tous les fichiers du projet
    await prisma.file.deleteMany({ where: { projectId } });
  }
}
