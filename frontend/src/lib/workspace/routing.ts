export function isInvalidWorkspaceSlug(workspaceSlug: string | null | undefined) {
  return !workspaceSlug || workspaceSlug === "undefined" || workspaceSlug === "null";
}

export function workspacePath(workspaceSlug: string | null | undefined, path: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    return "/auth/login";
  }

  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `/app/${workspaceSlug}/${cleanPath}`;
}
