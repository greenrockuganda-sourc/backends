import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { updateProfile } from '@/lib/api'
import { UserProfile } from '@/types'
import { notifyError, notifySuccess } from '@/lib/notify'

interface SettingsProps {
  user?: UserProfile | null
  token: string
  onProfileSave: (profile: UserProfile) => void
}

export default function Settings({ user, token, onProfileSave }: SettingsProps) {
  const [settings, setSettings] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    profileImage: '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUploadProgress, setImageUploadProgress] = useState(0)

  useEffect(() => {
    if (!user) {
      return
    }

    setSettings({
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      phoneNumber: user.phone_number || '',
      profileImage: user.profile_image || '',
    })
    setProfileImagePreview(user?.profile_image || '')
  }, [user])

  useEffect(() => {
    return () => {
      try { if (profileImagePreview) URL.revokeObjectURL(profileImagePreview) } catch {}
    }
  }, [profileImagePreview])

  const getCloudinaryFolder = (file: File) => {
    const folderPrefix = import.meta.env.VITE_CLOUDINARY_UPLOAD_FOLDER?.trim()
    if (!folderPrefix) {
      return undefined
    }

    const fileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    return `${folderPrefix}/${fileName}`
  }

  const handleSave = async () => {
    if (!user) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      let profileImageUrl = settings.profileImage
      if (profileImageFile) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        const useMock = !cloudName || !uploadPreset
        setUploadingImage(true)
        const simulateUpload = (file: File) => new Promise<string>((resolve) => {
          let pct = 0
          const id = setInterval(() => {
            pct += Math.floor(Math.random() * 25) + 10
            if (pct >= 100) pct = 100
            setImageUploadProgress(pct)
            if (pct === 100) {
              clearInterval(id)
              resolve(`https://via.placeholder.com/400.png?text=${encodeURIComponent(file.name)}`)
            }
          }, 200)
        })
        const uploadSingle = (file: File) => new Promise<string>((resolve, reject) => {
          if (useMock) {
            simulateUpload(file).then(resolve).catch(reject)
            return
          }
          const xhr = new XMLHttpRequest()
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/upload`)
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText).secure_url) } catch (e) { reject(e) }
            } else { reject(xhr.responseText) }
          }
          xhr.onerror = () => reject('Network error')
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setImageUploadProgress(Math.round((e.loaded / e.total) * 100))
            }
          }
          const form = new FormData();
          form.append('file', file)
          form.append('upload_preset', uploadPreset)
          const folder = getCloudinaryFolder(file)
          if (folder) {
            form.append('folder', folder)
          }
          xhr.send(form)
        })
        try {
          profileImageUrl = await uploadSingle(profileImageFile)
        } catch (err) {
          notifyError('Profile image upload failed')
          throw err
        } finally {
          setUploadingImage(false)
          setImageUploadProgress(0)
        }
      }

      const updated = await updateProfile(token, {
        first_name: settings.firstName,
        last_name: settings.lastName,
        phone_number: settings.phoneNumber,
        profile_image: profileImageUrl,
      })

      const updatedProfile: UserProfile = {
        ...user,
        first_name: updated.first_name || settings.firstName,
        last_name: updated.last_name || settings.lastName,
        phone_number: updated.phone_number ?? settings.phoneNumber,
        profile_image: updated.profile_image ?? settings.profileImage,
      }
      onProfileSave(updatedProfile)
      setSaved(true)
      notifySuccess('Profile updated')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile settings.')
      notifyError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="p-3 sm:p-6 lg:p-8">
        <div className="text-sm text-gray-600">Loading user settings…</div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 mt-1">Manage your account and profile settings</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Profile Information</h3>
        </div>

        <form className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={settings.firstName}
                onChange={(event) => setSettings({ ...settings, firstName: event.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={settings.lastName}
                onChange={(event) => setSettings({ ...settings, lastName: event.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={settings.email}
                readOnly
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={settings.phoneNumber}
                onChange={(event) => setSettings({ ...settings, phoneNumber: event.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div>
                  <img src={profileImagePreview || settings.profileImage || '/favicon.ico'} alt="avatar" className="w-20 h-20 rounded-full object-cover border" />
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0]
                      if (f) {
                        try { URL.revokeObjectURL(profileImagePreview) } catch {}
                        const url = URL.createObjectURL(f)
                        setProfileImageFile(f)
                        setProfileImagePreview(url)
                      }
                    }}
                    className="mb-2"
                  />
                  <input
                    type="url"
                    placeholder="Or paste image URL"
                    value={settings.profileImage}
                    onChange={(event) => setSettings({ ...settings, profileImage: event.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {uploadingImage && <div className="text-sm text-gray-500 mt-1">Uploading image... {imageUploadProgress}%</div>}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:bg-blue-300 w-full sm:w-auto"
        >
          <Save size={20} />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && (
          <span className="text-blue-600 text-sm font-medium">✓ Settings saved successfully</span>
        )}
      </div>
    </div>
  )
}
