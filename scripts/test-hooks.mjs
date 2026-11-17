// Lets `node --test` import the site's TypeScript the way the Astro build does:
// extensionless relative imports. Used only by `npm test`.
export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExt = /\.(?:mjs|cjs|js|json|ts|tsx|node)$/.test(specifier);
  if (relative && !hasExt) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(`${specifier}.mjs`, context);
    }
  }
  return nextResolve(specifier, context);
}
