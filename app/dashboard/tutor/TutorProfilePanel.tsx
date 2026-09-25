'use client'

import { useState, useEffect, useRef } from 'react'
import { upload } from '@vercel/blob/client'
import type { TutorProfileWithStats } from '@/lib/types'
import { TUTOR_INSTRUMENTS, MAX_PHOTO_SIZE_BYTES } from '@/lib/constants'
import { toDisplayImageUrl } from '@/lib/images'
import { formatHours } from '@/lib/lessons'
import AvailabilityEditor from './AvailabilityEditor'
import LessonRequestsPanel from './LessonRequestsPanel'
import MyStudentsPanel from './MyStudentsPanel'
import ReviewsPanel from './ReviewsPanel'
import PastLessonsPanel from './PastLessonsPanel'
import UpcomingLessonsPanel from './UpcomingLessonsPanel'
import ScheduleLessonModal from './ScheduleLessonModal'
import StarRating from '@/components/StarRating'

function Avatar({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500">
        {name[0]}
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={toDisplayImageUrl(url)} alt={name} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-16 h-16 rounded-full object-cover bg-gray-100" />
}

export default function TutorProfilePanel() {
  const [tutor, setTutor] = useState<TutorProfileWithStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [editingBio, setEditingBio] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [editingInstruments, setEditingInstruments] = useState(false)
  const [instrDraft, setInstrDraft] = useState<string[]>([])

  const [pendingCount, setPendingCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  useEffect(() => {
    fetch('/api/tutor/me')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setTutor(data.tutor ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: { bio?: string; instruments?: string[]; photoUrl?: string }) => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/tutor/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const data = await res.json()
      setTutor(data.tutor)
      setEditingBio(false)
      setEditingInstruments(false)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong.')
    }
    setSaving(false)
  }

  const handlePhotoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setError(`Photo must be under ${Math.round(MAX_PHOTO_SIZE_BYTES / 1024 / 1024)}MB.`)
      return
    }
    setUploadingPhoto(true)
    setError('')
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/tutor/photo/upload',
      })
      await save({ photoUrl: blob.url })
    } catch {
      setError('Failed to upload photo. Please try again.')
    }
    setUploadingPhoto(false)
  }

  const toggleInstrument = (inst: string) =>
    setInstrDraft(prev => (prev.includes(inst) ? prev.filter(x => x !== inst) : [...prev, inst]))

  if (loading) return <p className="text-gray-400 text-sm">Loading your profile…</p>
  if (!tutor) return <p className="text-gray-400 text-sm">Couldn&rsquo;t load your profile. Please refresh.</p>

  const sectionTitle = 'text-sm font-semibold text-gray-700 uppercase tracking-wide'

  return (
    <div className="space-y-10">
      {/* Profile header */}
      <section className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={tutor.name} url={tutor.photoUrl} />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center hover:bg-gray-700 transition disabled:opacity-50"
            aria-label="Change photo"
            title="Change photo"
          >
            {uploadingPhoto ? '…' : '✎'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePhotoSelect(file)
              e.target.value = ''
            }}
          />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{tutor.name}</p>
          <p className="text-sm text-gray-500">{tutor.instruments.join(', ') || 'No instruments yet'}</p>
          {tutor.credentials && <p className="text-xs text-gray-400 mt-1">{tutor.credentials}</p>}
          <p className="text-xs text-gray-500 mt-1.5">
            {tutor.lessonsCompleted} lessons · {formatHours(tutor.hoursCompleted)} hrs ·{' '}
            <StarRating rating={tutor.rating} reviewCount={tutor.reviewCount} />
          </p>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Bio */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className={sectionTitle}>Bio</h2>
          {!editingBio && (
            <button
              onClick={() => { setBioDraft(tutor.bio); setEditingBio(true); setError('') }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingBio ? (
          <div className="space-y-3">
            <textarea
              value={bioDraft} onChange={e => setBioDraft(e.target.value)} rows={4}
              placeholder="Tell families a bit about yourself…"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <div className="flex gap-3">
              <button onClick={() => save({ bio: bioDraft })} disabled={saving}
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingBio(false)} disabled={saving} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-2">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">{tutor.bio || 'No bio yet. Add one so families get to know you.'}</p>
        )}
      </section>

      {/* Instruments / proficiency */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className={sectionTitle}>Instruments I teach</h2>
          {!editingInstruments && (
            <button
              onClick={() => { setInstrDraft([...tutor.instruments]); setEditingInstruments(true); setError('') }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingInstruments ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {TUTOR_INSTRUMENTS.map(inst => {
                const on = instrDraft.includes(inst)
                return (
                  <button key={inst} type="button" onClick={() => toggleInstrument(inst)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${
                      on ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'
                    }`}>
                    {inst}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => save({ instruments: instrDraft })} disabled={saving}
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingInstruments(false)} disabled={saving} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-2">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tutor.instruments.length
              ? tutor.instruments.map(i => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm border border-gray-200 text-gray-700">{i}</span>
                ))
              : <p className="text-sm text-gray-400">None yet — add the instruments you can teach.</p>}
          </div>
        )}
      </section>

      {/* Availability */}
      <section>
        <h2 className={`${sectionTitle} mb-3`}>Availability</h2>
        <AvailabilityEditor />
      </section>

      {/* Schedule a lesson */}
      <section>
        <h2 className={`${sectionTitle} mb-3`}>Schedule a lesson</h2>
        <button
          type="button"
          onClick={() => setShowScheduleModal(true)}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition"
        >
          + Schedule a lesson
        </button>
      </section>

      {/* Upcoming Lessons */}
      <section>
        <h2 className={`${sectionTitle} mb-3`}>Upcoming Lessons</h2>
        <UpcomingLessonsPanel />
      </section>

      {/* Lesson requests */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className={sectionTitle}>Lesson requests</h2>
          {pendingCount > 0 && (
            <span className="bg-orange-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
              {pendingCount} new
            </span>
          )}
        </div>
        <LessonRequestsPanel onPendingCountChange={setPendingCount} />
      </section>

      {/* Past lessons */}
      <section>
        <h2 className={`${sectionTitle} mb-3`}>Past Lessons</h2>
        <PastLessonsPanel />
      </section>

      {/* Reviews */}
      <section>
        <h2 className={`${sectionTitle} mb-3`}>Reviews</h2>
        <ReviewsPanel />
      </section>

      {/* My students */}
      <section>
        <h2 className={`${sectionTitle} mb-3`}>My students</h2>
        <MyStudentsPanel />
      </section>

      {showScheduleModal && (
        <ScheduleLessonModal
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {}}
        />
      )}
    </div>
  )
}
