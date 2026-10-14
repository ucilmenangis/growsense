export function download(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  // The byte order mark lets Excel read Indonesian names in CSV correctly.
  const blob = new Blob(type.startsWith('text/csv') ? ['﻿', text] : [text], { type })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
