import { useEffect, useState } from 'react'
import { getBrands, createBrand, updateBrand, deleteBrand } from '@/lib/api'
import { Brand } from '@/types'
import { notifyError, notifySuccess } from '@/lib/notify'

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('access') || undefined : undefined

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const data = await getBrands()
        if (!active) return
        setBrands(Array.isArray(data) ? data.map((b: any) => ({ id: String(b.id), brand_name: b.brand_name || b.name || 'Unknown' })) : [])
      } catch (err) {
        notifyError(String(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const created = await createBrand(token, { brand_name: newName.trim() })
      setBrands((prev) => [{ id: String(created.id), brand_name: created.brand_name || newName.trim() }, ...prev])
      setNewName('')
      notifySuccess('Brand created')
    } catch (err) {
      notifyError(String(err))
    }
  }

  const handleEdit = async (brand: Brand) => {
    const next = window.prompt('Edit brand name', brand.brand_name)
    if (!next) return
    try {
      const updated = await updateBrand(token, brand.id, { brand_name: next.trim() })
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, brand_name: updated.brand_name || next.trim() } : b)))
      notifySuccess('Brand updated')
    } catch (err) {
      notifyError(String(err))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this brand?')) return
    try {
      await deleteBrand(token, id)
      setBrands((prev) => prev.filter((b) => b.id !== id))
      notifySuccess('Brand deleted')
    } catch (err) {
      notifyError(String(err))
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Brands</h2>
      <div className="mb-4 flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New brand" className="flex-1 border rounded px-3 py-2" />
        <button onClick={handleCreate} className="bg-blue-600 text-white px-3 py-2 rounded">Add</button>
      </div>
      {loading ? <div>Loading...</div> : (
        <div className="space-y-2">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center justify-between border rounded p-2">
              <span>{b.brand_name}</span>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(b)} className="text-sm text-blue-600">Edit</button>
                <button onClick={() => handleDelete(b.id)} className="text-sm text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
