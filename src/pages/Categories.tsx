import { useEffect, useState } from 'react'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/api'
import { Category } from '@/types'
import { notifyError, notifySuccess } from '@/lib/notify'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('access') || undefined : undefined

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const data = await getCategories()
        if (!active) return
        setCategories(Array.isArray(data) ? data.map((c: any) => ({ id: String(c.id), category_name: c.category_name || c.name || 'Unknown' })) : [])
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
      const created = await createCategory(token, { category_name: newName.trim() })
      setCategories((prev) => [{ id: String(created.id), category_name: created.category_name || newName.trim() }, ...prev])
      setNewName('')
      notifySuccess('Category created')
    } catch (err) {
      notifyError(String(err))
    }
  }

  const handleEdit = async (category: Category) => {
    const next = window.prompt('Edit category name', category.category_name)
    if (!next) return
    try {
      const updated = await updateCategory(token, category.id, { category_name: next.trim() })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, category_name: updated.category_name || next.trim() } : c)))
      notifySuccess('Category updated')
    } catch (err) {
      notifyError(String(err))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category?')) return
    try {
      await deleteCategory(token, id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      notifySuccess('Category deleted')
    } catch (err) {
      notifyError(String(err))
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Categories</h2>
      <div className="mb-4 flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" className="flex-1 border rounded px-3 py-2" />
        <button onClick={handleCreate} className="bg-blue-600 text-white px-3 py-2 rounded">Add</button>
      </div>
      {loading ? <div>Loading...</div> : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded p-2">
              <span>{c.category_name}</span>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(c)} className="text-sm text-blue-600">Edit</button>
                <button onClick={() => handleDelete(c.id)} className="text-sm text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
