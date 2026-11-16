/**
 * The UI is drawn with CSS zoom (--ui-zoom in index.css). getBoundingClientRect
 * and window.innerWidth/innerHeight report screen pixels, while top/left/width
 * set on an element inside the page are zoomed again. Convert through these
 * before positioning anything from measured coordinates.
 */
export function uiZoom(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom)
  return z > 0 ? z : 1
}

/** An element's bounding box in the page's own (unzoomed) CSS pixels. */
export function cssRect(el: Element): DOMRect {
  const r = el.getBoundingClientRect()
  const z = uiZoom()
  return new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z)
}

/** The viewport size in the page's own CSS pixels. */
export function cssViewport(): { width: number; height: number } {
  const z = uiZoom()
  return { width: window.innerWidth / z, height: window.innerHeight / z }
}
