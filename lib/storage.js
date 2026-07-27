const PRODUCT_IMAGE_MARKER = '/storage/v1/object/public/product-images/'

export function getProductImagePath(publicUrl) {
  if (typeof publicUrl !== 'string' || !publicUrl.includes(PRODUCT_IMAGE_MARKER)) return null

  try {
    const path = decodeURIComponent(publicUrl.split(PRODUCT_IMAGE_MARKER)[1])
    if (!path || path.includes('..') || path.startsWith('/')) return null
    return path
  } catch {
    return null
  }
}

export async function removeProductImage(supabase, publicUrl) {
  const path = getProductImagePath(publicUrl)
  if (!path) return

  const { error } = await supabase.storage.from('product-images').remove([path])
  if (error) {
    console.error('Failed to remove old product image:', {
      message: error.message,
      code: error.code,
      path,
    })
  }
}
