const MAX_EDGE = 640
const MAX_CHARS = 180000

export function readPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('This browser could not prepare that picture.'))
        return
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      let quality = 0.72
      let data = canvas.toDataURL('image/jpeg', quality)
      while (data.length > MAX_CHARS && quality > 0.4) {
        quality -= 0.1
        data = canvas.toDataURL('image/jpeg', quality)
      }
      if (data.length > MAX_CHARS) {
        reject(new Error('That picture is still too large after shrinking it.'))
        return
      }
      resolve(data)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That picture could not be read.'))
    }
    image.src = url
  })
}
