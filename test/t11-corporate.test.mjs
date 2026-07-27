import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { getCorporateDictionary } from '../lib/i18n/corporate.js'
import { CORPORATE_PAGE_CONFIG } from '../lib/site-config.mjs'
import { localizedAlternates, safeJsonLd } from '../lib/seo.mjs'

test('T11 corporate content is localized and avoids unconfirmed About claims', () => {
  const ru = getCorporateDictionary('ru')
  const kk = getCorporateDictionary('kk')
  assert.equal(ru.pages.about.title, 'О компании')
  assert.equal(kk.pages.about.title, 'Біз туралы')
  assert.doesNotMatch(`${ru.pages.about.intro} ${ru.pages.about.notice}`, /2013|5 магазинов|1000\+|официальную гарантию/i)
  assert.match(ru.pages.deliveryWarranty.notice, /черновой/i)
  assert.match(kk.pages.privacy.notice, /черновик/i)
})

test('T11 SEO helper emits localized canonical, alternates, and escaped JSON-LD', () => {
  const alternates = localizedAlternates('kk', '/about')
  assert.equal(alternates.canonical, 'http://localhost:3000/kk/about')
  assert.equal(alternates.languages.ru, 'http://localhost:3000/ru/about')
  assert.equal(alternates.languages.kk, 'http://localhost:3000/kk/about')
  assert.equal(alternates.languages['x-default'], 'http://localhost:3000/ru/about')
  assert.match(safeJsonLd({ text: '</script>' }), /\\u003c\/script>/)
})

test('T11 publication config keeps the privacy shell out of the sitemap', async () => {
  assert.equal(CORPORATE_PAGE_CONFIG.about.published, true)
  assert.equal(CORPORATE_PAGE_CONFIG.deliveryWarranty.published, true)
  assert.equal(CORPORATE_PAGE_CONFIG.contacts.published, true)
  assert.equal(CORPORATE_PAGE_CONFIG.privacy.published, false)

  const sitemap = await readFile(new URL('../app/sitemap.js', import.meta.url), 'utf8')
  const robots = await readFile(new URL('../app/robots.js', import.meta.url), 'utf8')
  assert.match(sitemap, /CORPORATE_PAGE_CONFIG/)
  assert.match(robots, /['"]\/admin['"]/)
  assert.match(robots, /['"]\/api\//)
  assert.match(robots, /['"]\/import\//)
})

test('T11 legacy About and Contacts components contain no old factual claims', async () => {
  const [about, contacts] = await Promise.all([
    readFile(new URL('../components/AboutSection.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/ContactsSection.js', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(`${about}\n${contacts}`, /2013|5 магазинов|1000\+|официальную гарантию/i)
})
