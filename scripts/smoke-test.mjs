const BASE = process.env.BASE_URL || 'http://localhost:8080'

async function okRes(res) {
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${text}`)
  try { return JSON.parse(text) } catch { return text }
}

async function testCategories() {
  console.log('\nTesting /api/categories')
  const list = await okRes(await fetch(`${BASE}/api/categories`))
  console.log('GET categories ->', Array.isArray(list) ? `${list.length} items` : typeof list)

  const payload = { category_name: `smoke-${Date.now()}` }
  const created = await okRes(await fetch(`${BASE}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
  console.log('POST categories ->', created && created.id ? `created id=${created.id}` : created)
}

async function testBrands() {
  console.log('\nTesting /api/brands')
  const list = await okRes(await fetch(`${BASE}/api/brands`))
  console.log('GET brands ->', Array.isArray(list) ? `${list.length} items` : typeof list)

  const payload = { brand_name: `smoke-${Date.now()}` }
  const created = await okRes(await fetch(`${BASE}/api/brands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
  console.log('POST brands ->', created && created.id ? `created id=${created.id}` : created)
}

async function run() {
  try {
    console.log('Smoke test base URL:', BASE)
    await testCategories()
    await testBrands()
    console.log('\nSmoke test completed successfully')
  } catch (err) {
    console.error('\nSmoke test failed:', err instanceof Error ? err.message : String(err))
    process.exitCode = 2
  }
}

run()
