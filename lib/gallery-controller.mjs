export class GalleryController {
  constructor({ setEditor, setMessage, authFetch, jsonOrError, onBusyChange }) {
    this.setEditor = setEditor
    this.setMessage = setMessage
    this.authFetch = authFetch
    this.jsonOrError = jsonOrError
    this.onBusyChange = onBusyChange
    this.isBusy = false
  }

  setBusy(busy) {
    this.isBusy = busy
    if (typeof this.onBusyChange === 'function') {
      this.onBusyChange(busy)
    }
  }

  async reorderImages(editor, newImages) {
    if (!editor?.id || this.isBusy) return false

    this.setBusy(true)
    const productId = editor.id
    const previousImages = editor.images || []

    this.setEditor((current) => (current?.id === productId ? { ...current, images: newImages } : current))

    try {
      const imageIds = newImages.map((img) => img.id)
      const res = await this.authFetch(`/api/admin/catalog/products/${productId}/gallery/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ids: imageIds }),
      })
      await this.jsonOrError(res)
      return true
    } catch (error) {
      this.setEditor((current) => (current?.id === productId ? { ...current, images: previousImages } : current))
      if (this.setMessage) this.setMessage({ type: 'error', text: error.message || 'Ошибка переупорядочивания' })
      return false
    } finally {
      this.setBusy(false)
    }
  }

  async deleteImage(editor, image) {
    if (!editor?.id || this.isBusy) return false

    this.setBusy(true)
    const productId = editor.id

    try {
      const res = await this.authFetch(`/api/admin/catalog/products/${productId}/gallery/${image.id}`, { method: 'DELETE' })
      await this.jsonOrError(res)

      this.setEditor((current) => {
        if (current?.id !== productId) return current
        const remaining = (current.images || []).filter((entry) => entry.id !== image.id)
        if (image.is_primary && remaining.length > 0) {
          remaining[0] = { ...remaining[0], is_primary: true }
        }
        return { ...current, images: remaining }
      })
      return true
    } catch (error) {
      if (this.setMessage) this.setMessage({ type: 'error', text: error.message })
      return false
    } finally {
      this.setBusy(false)
    }
  }

  async updateImage(editor, image, changes) {
    if (!editor?.id || this.isBusy) return false

    this.setBusy(true)
    const productId = editor.id

    try {
      const res = await this.authFetch(`/api/admin/catalog/products/${productId}/gallery/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const updated = await this.jsonOrError(res)

      this.setEditor((current) => {
        if (current?.id !== productId) return current
        return {
          ...current,
          images: (current.images || []).map((entry) =>
            entry.id === updated.id ? updated : changes.is_primary ? { ...entry, is_primary: false } : entry
          ),
        }
      })
      return true
    } catch (error) {
      if (this.setMessage) this.setMessage({ type: 'error', text: error.message })
      return false
    } finally {
      this.setBusy(false)
    }
  }

  async uploadGalleryImage(editor, file) {
    if (!file || !editor?.id || this.isBusy) return false

    this.setBusy(true)
    const productId = editor.id

    try {
      const form = new FormData()
      form.append('file', file)
      const uploadRes = await this.authFetch('/api/upload', { method: 'POST', body: form })
      const upload = await this.jsonOrError(uploadRes)

      const images = editor.images || []
      const galleryRes = await this.authFetch(`/api/admin/catalog/products/${productId}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: upload.url, sort_order: images.length, is_primary: images.length === 0 }),
      })
      const image = await this.jsonOrError(galleryRes)

      this.setEditor((current) => {
        if (current?.id !== productId) return current
        return { ...current, images: [...(current.images || []), image] }
      })
      if (this.setMessage) this.setMessage({ type: 'success', text: 'Изображение добавлено' })
      return true
    } catch (error) {
      if (this.setMessage) this.setMessage({ type: 'error', text: error.message })
      return false
    } finally {
      this.setBusy(false)
    }
  }
}
