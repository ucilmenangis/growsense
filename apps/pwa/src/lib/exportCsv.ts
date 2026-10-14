// Monthly recap as CSV. The format itself lives in @growsense/core, shared with the dashboard.
export { cell, monthlyCsv } from '@growsense/core'

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
