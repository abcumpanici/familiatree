export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFileName(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} _-]+/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'family-tree'
  )
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
