import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GalleryController } from '../lib/gallery-controller.mjs'
import { SaveController } from '../lib/save-controller.mjs'

test('GalleryController: concurrent operations trigger API call exactly ONCE due to synchronous mutex', async () => {
  let activeEditor = { id: 'prod-100', images: [{ id: 'img-1' }, { id: 'img-2' }] }
  let apiCallCount = 0

  const mockAuthFetch = async () => {
    apiCallCount++
    await new Promise((resolve) => setTimeout(resolve, 50))
    return { ok: true, json: async () => ({}) }
  }

  const controller = new GalleryController({
    setEditor: (updater) => {
      activeEditor = typeof updater === 'function' ? updater(activeEditor) : updater
    },
    setMessage: () => {},
    authFetch: mockAuthFetch,
    jsonOrError: async (res) => res.json(),
  })

  // Trigger two concurrent reorder requests
  const p1 = controller.reorderImages(activeEditor, [{ id: 'img-2' }, { id: 'img-1' }])
  const p2 = controller.reorderImages(activeEditor, [{ id: 'img-1' }, { id: 'img-2' }])

  const [res1, res2] = await Promise.all([p1, p2])

  assert.equal(res1, true, 'First reorder call should succeed')
  assert.equal(res2, false, 'Second concurrent reorder call should be blocked immediately by mutex')
  assert.equal(apiCallCount, 1, 'API must be invoked exactly ONCE')
  assert.equal(controller.isBusy, false, 'Mutex must reset to false after completion')
})

test('GalleryController: reorderImages rolls back local image state on API failure', async () => {
  let activeEditor = { id: 'prod-100', images: [{ id: 'img-1' }, { id: 'img-2' }] }

  const mockFailingAuthFetch = async () => {
    return { ok: false, json: async () => ({ error: 'Database error' }) }
  }

  const controller = new GalleryController({
    setEditor: (updater) => {
      activeEditor = typeof updater === 'function' ? updater(activeEditor) : updater
    },
    setMessage: () => {},
    authFetch: mockFailingAuthFetch,
    jsonOrError: async () => {
      throw new Error('Database error')
    },
  })

  const initialImages = [...activeEditor.images]
  const success = await controller.reorderImages(activeEditor, [{ id: 'img-2' }, { id: 'img-1' }])

  assert.equal(success, false)
  assert.deepEqual(activeEditor.images, initialImages, 'Reorder failure must restore original image order')
  assert.equal(controller.isBusy, false, 'Mutex must reset to false after error')
})

test('GalleryController: completion of operation on Product A does NOT modify active Product B', async () => {
  let activeEditor = { id: 'product-A', images: [{ id: 'img-A1' }, { id: 'img-A2' }] }

  let resolveApiCall
  const mockSlowAuthFetch = async () => {
    await new Promise((resolve) => {
      resolveApiCall = resolve
    })
    return { ok: true, json: async () => ({ id: 'img-A2', is_primary: true }) }
  }

  const controller = new GalleryController({
    setEditor: (updater) => {
      activeEditor = typeof updater === 'function' ? updater(activeEditor) : updater
    },
    setMessage: () => {},
    authFetch: mockSlowAuthFetch,
    jsonOrError: async (res) => res.json(),
  })

  // 1. Start update image on Product A
  const productA = activeEditor
  const updatePromise = controller.updateImage(productA, { id: 'img-A2' }, { is_primary: true })

  // 2. User switches to Product B while request is in flight
  const productB = { id: 'product-B', images: [{ id: 'img-B1' }] }
  activeEditor = productB

  // 3. Resolve Product A request
  resolveApiCall()
  await updatePromise

  // 4. Verify Product B state was NOT altered
  assert.equal(activeEditor.id, 'product-B')
  assert.deepEqual(activeEditor.images, [{ id: 'img-B1' }], 'Product B state must remain untouched by Product A API completion')
})

test('GalleryController: deleteImage leaves gallery untouched on failure and updates state on success', async () => {
  let activeEditor = { id: 'prod-100', images: [{ id: 'img-1', is_primary: true }, { id: 'img-2', is_primary: false }] }
  let shouldFail = true

  const mockAuthFetch = async () => {
    if (shouldFail) throw new Error('Delete API failure')
    return { ok: true, json: async () => ({}) }
  }

  const controller = new GalleryController({
    setEditor: (updater) => {
      activeEditor = typeof updater === 'function' ? updater(activeEditor) : updater
    },
    setMessage: () => {},
    authFetch: mockAuthFetch,
    jsonOrError: async (res) => res.json(),
  })

  // 1. Failed delete keeps state intact
  const initial = [...activeEditor.images]
  const resFail = await controller.deleteImage(activeEditor, { id: 'img-1', is_primary: true })
  assert.equal(resFail, false)
  assert.deepEqual(activeEditor.images, initial, 'Failed delete must leave gallery unchanged')

  // 2. Successful delete updates state
  shouldFail = false
  const resSuccess = await controller.deleteImage(activeEditor, { id: 'img-1', is_primary: true })
  assert.equal(resSuccess, true)
  assert.equal(activeEditor.images.length, 1)
  assert.equal(activeEditor.images[0].id, 'img-2')
  assert.equal(activeEditor.images[0].is_primary, true)
})

test('SaveController: two concurrent save calls trigger API exactly ONCE due to synchronous saveBusyRef mutex', async () => {
  let activeEditor = { id: 'prod-A', sku: 'SKU-A', price: {} }
  let apiCallCount = 0
  let isSavingState = false
  const saveBusyRef = { current: false }

  const mockAuthFetch = async () => {
    apiCallCount++
    await new Promise((resolve) => setTimeout(resolve, 50))
    return { ok: true, json: async () => ({ id: 'prod-A' }) }
  }

  const controller = new SaveController({
    setEditor: (updater) => {
      activeEditor = typeof updater === 'function' ? updater(activeEditor) : updater
    },
    setMessage: () => {},
    setIsSaving: (val) => {
      isSavingState = val
    },
    authFetch: mockAuthFetch,
    jsonOrError: async (res) => res.json(),
    loadProducts: async () => {},
    saveBusyRef,
  })

  // Concurrent saves
  const p1 = controller.save(activeEditor)
  const p2 = controller.save(activeEditor)

  const [res1, res2] = await Promise.all([p1, p2])

  assert.equal(res1, true, 'First save call must succeed')
  assert.equal(res2, false, 'Second concurrent save call must be blocked immediately by saveBusyRef')
  assert.equal(apiCallCount, 1, 'API must be invoked exactly ONCE')
  assert.equal(saveBusyRef.current, false, 'Mutex ref must reset to false after completion')
  assert.equal(isSavingState, false, 'isSaving UI state must reset to false in finally')
})

test('SaveController: completion of save on Product A does NOT modify active Product B editor', async () => {
  let activeEditor = { id: 'prod-A', sku: 'SKU-A', price: {} }
  let resolveApiCall
  const saveBusyRef = { current: false }

  const mockSlowAuthFetch = async () => {
    await new Promise((resolve) => {
      resolveApiCall = resolve
    })
    return { ok: true, json: async () => ({ id: 'prod-A' }) }
  }

  const controller = new SaveController({
    setEditor: (updater) => {
      activeEditor = typeof updater === 'function' ? updater(activeEditor) : updater
    },
    setMessage: () => {},
    setIsSaving: () => {},
    authFetch: mockSlowAuthFetch,
    jsonOrError: async (res) => res.json(),
    loadProducts: async () => {},
    saveBusyRef,
  })

  // 1. Start save on Product A
  const productA = activeEditor
  const savePromise = controller.save(productA)

  // 2. User switches to Product B while save request is in flight
  const productB = { id: 'prod-B', sku: 'SKU-B', price: {} }
  activeEditor = productB

  // 3. Resolve Product A request
  resolveApiCall()
  await savePromise

  // 4. Verify Product B state was NOT altered
  assert.equal(activeEditor.id, 'prod-B')
  assert.equal(activeEditor.sku, 'SKU-B', 'Product B editor state must remain untouched by Product A save completion')
})
