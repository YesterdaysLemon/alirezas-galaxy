// Exact reviewed ownership mapping, shared by discovery and branding downloads.
const ownedRedirects = new Map([
  [
    'https://innermanagement.alirezaafshan.com',
    'https://innermanagement.systems',
  ],
]);

export function hasOwnedRedirect(origin) {
  return ownedRedirects.has(origin);
}

/** Preserve path/query and refuse every other destination or URL decoration. */
export function ownedRedirectTarget(source, location) {
  try {
    const current = new URL(source);
    const target = ownedRedirects.get(current.origin);
    if (
      !target ||
      !location ||
      current.username ||
      current.password ||
      current.port ||
      current.hash
    )
      return null;
    const destination = new URL(location, current);
    const expected = new URL(target);
    expected.pathname = current.pathname;
    expected.search = current.search;
    return destination.href === expected.href ? destination.href : null;
  } catch {
    return null;
  }
}
