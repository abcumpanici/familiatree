export async function resizePhoto(file: File, size = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = size / Math.min(bitmap.width, bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot edit photos')
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.82),
  )
  if (blob && blob.type === 'image/webp') return blob
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not save the photo'))),
      'image/jpeg',
      0.85,
    ),
  )
}
