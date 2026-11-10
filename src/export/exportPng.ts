/**
 * PNG export for calendar snapshot.
 * Uses html-to-image for crisp 2× pixel ratio capture.
 */

export async function generateAndDownloadPNG(monthPlan: {
  year: number
  month: number
  days: Array<{ date: string }>
}): Promise<void> {
  try {
    // Dynamically import html-to-image to keep initial bundle small
    const { toPng } = await import('html-to-image')

    // Get the calendar container
    const container = document.querySelector('[data-calendar-container]')
    if (!container) {
      alert('Virhe: Kalenterisäiliötä ei löydy. Katso konsoli (F12).')
      return
    }

    // Wait for fonts to load
    if ('fonts' in document) {
      await (document.fonts as FontFaceSet).ready
    }

    // Force layout and get actual dimensions
    const element = container as HTMLElement
    const originalOverflow = element.style.overflow
    const originalHeight = element.style.height
    const originalMaxWidth = element.style.maxWidth
    const originalMarginLeft = element.style.marginLeft
    const originalMarginRight = element.style.marginRight
    const originalWidth = element.style.width

    // Temporarily enable visible overflow to capture full content
    element.style.overflow = 'visible'
    element.style.height = 'auto'

    // Force a reflow to compute full height
    const scrollHeight = element.scrollHeight
    const scrollWidth = element.scrollWidth

    // Neutralize Tailwind `mx-auto max-w-6xl` via inline styles (inline beats
    // class). Without this, html-to-image's clone is re-parented into a
    // wrapper where `margin: 0 auto` resolves to non-zero margins, shifting
    // the calendar to the right and clipping LA/SU columns.
    element.style.maxWidth = 'none'
    element.style.width = `${scrollWidth}px`
    element.style.marginLeft = '0'
    element.style.marginRight = '0'

    const originalBg = element.style.backgroundColor
    element.style.backgroundColor = 'rgb(252, 250, 246)' // cream-50

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 2,
        width: scrollWidth,
        height: scrollHeight,
        backgroundColor: 'rgb(252, 250, 246)', // cream-50
        allowTaint: true, // Allow CORS/external resources
        useCORS: true, // Attempt CORS for external resources
        filter: (node: Node) => {
          if (node instanceof HTMLElement) {
            if (node.hasAttribute('data-png-exclude')) return false
            // Drop fixed-positioned chrome (drawers, toasts, modals) — they
            // are DOM descendants of the container but visually overlay the
            // viewport. When html-to-image clones them into a foreignObject
            // they lose their viewport anchor and shift/expand the capture.
            if (getComputedStyle(node).position === 'fixed') return false
          }
          return true
        },
      } as any)

      // Trigger download
      const months = [
        'tammikuu',
        'helmikuu',
        'maaliskuu',
        'huhtikuu',
        'toukokuu',
        'kesäkuu',
        'heinäkuu',
        'elokuu',
        'syyskuu',
        'lokakuu',
        'marraskuu',
        'joulukuu',
      ]
      const monthName = months[monthPlan.month - 1]
      const filename = `tyovuorot_${monthName}_${monthPlan.year}.png`

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      // Restore original styles
      element.style.backgroundColor = originalBg
      element.style.overflow = originalOverflow
      element.style.height = originalHeight
      element.style.maxWidth = originalMaxWidth
      element.style.width = originalWidth
      element.style.marginLeft = originalMarginLeft
      element.style.marginRight = originalMarginRight
    }
  } catch (error) {
    console.error('PNG export failed:', error)
    alert('Virhe: PNG-viennin epäonnistui. Katso konsoli (F12).')
  }
}
