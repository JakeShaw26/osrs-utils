/**
 * Applies the theme class before first paint.
 *
 * This runs as a blocking inline script on purpose. Doing it in a useEffect
 * would let the browser paint the light theme first, producing a white flash on
 * every load for what we expect to be a majority-dark-mode audience. That flash
 * is the entire reason this file exists.
 *
 * Resolution order: explicit user choice > OS preference > dark.
 * Dark is the fallback rather than light — see docs/adr/0009 and docs/theming.md.
 */

export const THEME_STORAGE_KEY = 'osrs-toolkit-theme';

const script = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var isDark =
      stored === 'dark' ||
      (stored === 'light' ? false
        : !window.matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {
    // localStorage can throw in private mode / blocked-cookie contexts.
    // Fall back to the default theme rather than breaking the whole page.
    document.documentElement.classList.add('dark');
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />;
}
