export class SaveController {
  constructor({ setEditor, setMessage, setIsSaving, authFetch, jsonOrError, loadProducts, attributes = [], saveBusyRef }) {
    this.setEditor = setEditor
    this.setMessage = setMessage
    this.setIsSaving = setIsSaving
    this.authFetch = authFetch
    this.jsonOrError = jsonOrError
    this.loadProducts = loadProducts
    this.attributes = attributes
    this.saveBusyRef = saveBusyRef || { current: false }
  }

  get isBusy() {
    return Boolean(this.saveBusyRef.current)
  }

  async save(editor, attributesOverride) {
    if (!editor || this.saveBusyRef.current === true) {
      return false
    }

    // Synchronous mutex lock BEFORE first await
    this.saveBusyRef.current = true
    if (typeof this.setIsSaving === 'function') {
      this.setIsSaving(true)
    }

    const productId = editor.id || null
    const availableAttributes = attributesOverride || this.attributes || []

    try {
      const payload = {
        sku: editor.sku,
        external_id: editor.external_id,
        slug: editor.slug,
        category_id: editor.category_id || null,
        brand_id: editor.brand_id || null,
        name_ru: editor.name_ru,
        name_kk: editor.name_kk,
        short_description_ru: editor.short_description_ru,
        short_description_kk: editor.short_description_kk,
        description_ru: editor.description_ru,
        description_kk: editor.description_kk,
        warranty_ru: editor.warranty_ru,
        warranty_kk: editor.warranty_kk,
        price: {
          ...editor.price,
          amount: editor.price.amount === '' ? null : Number(editor.price.amount),
          old_amount: editor.price.old_amount === '' ? null : Number(editor.price.old_amount),
        },
        stock_status: editor.stock_status,
        publication_status: editor.publication_status,
        publish_ru: editor.publish_ru,
        publish_kk: editor.publish_kk,
        translation_status_kk: editor.translation_status_kk,
        is_featured: editor.is_featured,
        sort_order: editor.sort_order,
        seo: editor.seo,
        attributes: (editor.attributes || []).map(({ attribute, id, ...value }) => {
          const attrMeta = availableAttributes.find((a) => a.id === value.attribute_id)
          return { ...value, data_type: attrMeta?.data_type || 'text' }
        }),
      }

      const response = await this.authFetch(
        productId ? `/api/admin/catalog/products/${productId}` : '/api/admin/catalog/products',
        {
          method: productId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const body = await this.jsonOrError(response)

      if (this.setMessage) {
        this.setMessage({ type: 'success', text: productId ? 'Товар обновлён' : 'Товар создан' })
      }

      if (typeof this.setEditor === 'function') {
        this.setEditor((current) => {
          if (productId) {
            if (current?.id !== productId) return current
            return { ...current }
          } else {
            if (current?.id) return current
            return { ...current, id: body.id }
          }
        })
      }

      if (typeof this.loadProducts === 'function') {
        await this.loadProducts()
      }

      return true
    } catch (error) {
      if (this.setMessage) {
        this.setMessage({ type: 'error', text: error.message || 'Ошибка сохранения' })
      }
      return false
    } finally {
      this.saveBusyRef.current = false
      if (typeof this.setIsSaving === 'function') {
        this.setIsSaving(false)
      }
    }
  }
}
