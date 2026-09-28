export function keyboardCoversToolbar(editing: boolean, layoutHeight: number, visualHeight: number, scale: number): boolean {
  return editing && Math.abs(scale - 1) < 0.05 && layoutHeight - visualHeight > 120
}

// After the iOS keyboard closes, WKWebView can leave the visible area shifted inside the page, so fixed
// and sticky bars (the bottom toolbar, the header) sit mid-screen. True when nothing is being edited,
// the page isn't pinch-zoomed, and the visible area is still offset.
export function viewportLeftShifted(editing: boolean, offsetTop: number, scale: number): boolean {
  return !editing && Math.abs(scale - 1) < 0.05 && offsetTop > 1
}
