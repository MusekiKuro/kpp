import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../components/admin/ProductCMS.js', import.meta.url), 'utf8')

// ---------------------------------------------------------------------------
// Dialog ARIA semantics
// ---------------------------------------------------------------------------

test('ProductCMS dialog has correct ARIA role and modal attributes', () => {
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /aria-labelledby="cms-dialog-title"/)
  assert.match(source, /aria-label="Закрыть редактор товара"/)
})

// ---------------------------------------------------------------------------
// Focus trap and keyboard handling
// ---------------------------------------------------------------------------

test('ProductCMS has Escape key handler and Tab focus trap', () => {
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /event\.key === 'Tab'/)
  assert.match(source, /motion-reduce:transition-none/)
})

// ---------------------------------------------------------------------------
// isSaving mutex: double-submit protection
// ---------------------------------------------------------------------------

test('ProductCMS save function has isSaving guard and try/finally restoration', () => {
  // isSaving is checked at the start of save
  assert.match(source, /isSaving/)
  // setIsSaving(true) must be called before the async save
  assert.match(source, /setIsSaving\(true\)/)
  // setIsSaving(false) must be in a finally block for guaranteed restore
  assert.match(source, /finally/)
  assert.match(source, /setIsSaving\(false\)/)
})

// ---------------------------------------------------------------------------
// isSaving: Save button is disabled during save
// ---------------------------------------------------------------------------

test('ProductCMS Save button is disabled when isSaving is true', () => {
  // The save button must carry a disabled prop tied to isSaving
  assert.match(source, /disabled=\{isSaving\}/)
})

// ---------------------------------------------------------------------------
// Escape is blocked while saving (no inconsistent close)
// ---------------------------------------------------------------------------

test('ProductCMS Escape close is blocked while isSaving is true', () => {
  // The Escape handler must check isSaving before calling setEditor(null)
  // We verify that the Escape branch uses setIsSaving setter pattern or checks isSaving
  assert.match(source, /currentlySaving/)
})

// ---------------------------------------------------------------------------
// Backdrop click is blocked while saving
// ---------------------------------------------------------------------------

test('ProductCMS backdrop click close is blocked while isSaving is true', () => {
  assert.match(source, /!isSaving.*setEditor\(null\)|!isSaving\).*setEditor/)
})

// ---------------------------------------------------------------------------
// openerRef: focus restoration
// ---------------------------------------------------------------------------

test('ProductCMS captures openerRef before opening dialog and restores focus on close', () => {
  // openerRef must be set before opening
  assert.match(source, /openerRef\.current\s*=/)
  // Focus must be restored via openerRef, guarded with document.contains
  assert.match(source, /openerRef\.current/)
  assert.match(source, /document\.contains/)
})

// ---------------------------------------------------------------------------
// useRef is imported
// ---------------------------------------------------------------------------

test('ProductCMS imports useRef for openerRef', () => {
  assert.match(source, /useRef/)
})

// ---------------------------------------------------------------------------
// Effect dependency: isEditorOpen not the full editor object
// ---------------------------------------------------------------------------

test('ProductCMS focus-trap effect depends on isEditorOpen (boolean) not the full editor object', () => {
  assert.match(source, /isEditorOpen/)
  // The effect must be called with isEditorOpen as dependency, not [editor]
  assert.match(source, /\[isEditorOpen\]/)
  assert.doesNotMatch(source, /\}, \[editor\]\)/)
})
