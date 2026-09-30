// Gravatar "mystery person" — the standard gray silhouette placeholder avatar
// used across social platforms. Forced default via d=mp&f=y.
export const DEFAULT_AVATAR_URL =
  'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y&s=256'

// Lessons and hours from before the platform tracked them. The landing page adds
// the live completed-lesson totals from the Lessons tab on top of these.
export const HISTORICAL_LESSONS = 214
export const HISTORICAL_HOURS = 172

// Cap on a tutor's uploaded profile photo (Vercel Blob).
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

// Shared options for the child forms (signup + parent dashboard "manage children").
export const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

// One list for both sides — tutors mark what they can teach, students mark what
// they want to learn — so the two can't drift apart. Grouped by family; the
// order here is the order chips render in. Names are stored verbatim on
// tutor/child rows, so never rename an existing entry (append or reorder only).
export const INSTRUMENTS = [
  // Strings
  'Violin', 'Viola', 'Cello', 'Bass', 'Upright Bass', 'Guitar', 'Classical Guitar',
  'Ukulele', 'Banjo', 'Mandolin', 'Harp',
  // Keys
  'Piano', 'Keyboard', 'Organ', 'Accordion',
  // Woodwinds
  'Flute', 'Piccolo', 'Recorder', 'Clarinet', 'Bass Clarinet', 'Oboe', 'Bassoon',
  'Soprano Saxophone', 'Alto Saxophone', 'Tenor Saxophone', 'Baritone Saxophone',
  // Brass
  'Trumpet', 'Cornet', 'French Horn', 'Trombone', 'Baritone Horn', 'Euphonium', 'Tuba',
  // Percussion
  'Drums', 'Percussion', 'Marimba', 'Xylophone', 'Glockenspiel', 'Timpani',
  // Voice & other
  'Voice', 'Harmonica', 'Other',
]
