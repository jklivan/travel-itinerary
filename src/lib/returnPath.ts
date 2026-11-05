// A "go back here afterwards" link from a query string: only a path on this site.
export const returnPath = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && value.length <= 300 ? value : null
