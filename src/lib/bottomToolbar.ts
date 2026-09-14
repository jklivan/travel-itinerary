// Use document coordinates rather than iOS's keyboard-shifted fixed viewport.
export function bottomToolbarTop(scrollY: number, viewportHeight: number, toolbarHeight: number): number {
  return Math.max(0, scrollY) + Math.max(0, viewportHeight - toolbarHeight)
}

export function keyboardCoversToolbar(editing: boolean, layoutHeight: number, visualHeight: number, scale: number): boolean {
  return editing && Math.abs(scale - 1) < 0.05 && layoutHeight - visualHeight > 120
}
