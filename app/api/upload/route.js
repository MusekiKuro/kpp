import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_MULTIPART_BODY_SIZE = MAX_FILE_SIZE + 64 * 1024
const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg' },
  'image/png': { extension: 'png' },
  'image/webp': { extension: 'webp' },
  'image/gif': { extension: 'gif' },
  'image/avif': { extension: 'avif' },
}

function hasPrefix(bytes, prefix) {
  return prefix.every((value, index) => bytes[index] === value)
}

function detectImageType(bytes) {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'image/gif'
  if (bytes.length >= 12 && hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.slice(8, 12).every((value, index) => value === [0x57, 0x45, 0x42, 0x50][index])) {
    return 'image/webp'
  }
  if (bytes.length >= 16 && bytes.slice(4, 8).every((value, index) => value === [0x66, 0x74, 0x79, 0x70][index])) {
    const brands = Buffer.from(bytes.slice(8, 64)).toString('ascii')
    if (brands.includes('avif') || brands.includes('avis')) return 'image/avif'
  }
  return null
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_SIZE) {
      return NextResponse.json({ error: 'File is too large' }, { status: 413 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 5 MB' }, { status: 400 })
    }
    if (!Object.hasOwn(IMAGE_TYPES, file.type)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const detectedType = detectImageType(buffer)
    if (detectedType !== file.type) {
      return NextResponse.json({ error: 'File contents do not match its MIME type' }, { status: 400 })
    }

    const extension = IMAGE_TYPES[detectedType].extension
    const filename = `${Date.now()}-${randomUUID()}.${extension}`
    const { data, error } = await auth.supabase.storage.from('product-images').upload(filename, buffer, {
      contentType: detectedType,
      upsert: false,
    })

    if (error) {
      console.error('Upload API storage upload failed:', { message: error.message, code: error.code })
      return NextResponse.json({ error: 'Unable to upload image' }, { status: 500 })
    }

    const { data: urlData } = auth.supabase.storage.from('product-images').getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error('Upload API crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
