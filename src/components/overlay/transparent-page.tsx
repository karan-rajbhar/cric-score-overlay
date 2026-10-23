/**
 * Whatever the browser or the app's theme would paint, an overlay page is
 * transparent: streaming tools composite it over the camera. (OBS's
 * default custom CSS does the same; other tools, or a cleared field, do
 * not.) Rendered by every overlay page, so it is in the first HTML.
 */
const TRANSPARENT_PAGE =
  "html,body{background:transparent!important;color-scheme:normal!important;overflow:hidden}";

export function TransparentPage() {
  return <style>{TRANSPARENT_PAGE}</style>;
}
