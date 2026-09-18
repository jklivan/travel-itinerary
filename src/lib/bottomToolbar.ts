export function keyboardCoversToolbar(editing: boolean, layoutHeight: number, visualHeight: number, scale: number): boolean {
  return editing && Math.abs(scale - 1) < 0.05 && layoutHeight - visualHeight > 120
}
