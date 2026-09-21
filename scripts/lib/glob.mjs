// Minimal glob-to-regexp for scope matching in fast, dependency-free checks.
// Deliberately has no imports: a check that stays fast and network/git-free
// must not pull in node:child_process transitively through a shared helper.
function segmentToRegExpSource(segment) {
  if (segment === '**') return '.*'
  return segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
}

export function globToRegExp(glob) {
  const source = glob.split('/').map(segmentToRegExpSource).join('/')
  return new RegExp(`^${source}$`)
}

export function matchesAnyGlob(filePath, globs) {
  return globs.some((glob) => globToRegExp(glob).test(filePath))
}
