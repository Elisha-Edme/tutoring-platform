// Default password assigned to every tutor account at creation. Tutors don't
// self-register yet, so this lets them sign in later with a known password.
export const DEFAULT_TUTOR_PASSWORD = 'TuneUp123'

// Gravatar "mystery person" — the standard gray silhouette placeholder avatar
// used across social platforms. Forced default via d=mp&f=y.
export const DEFAULT_AVATAR_URL =
  'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y&s=256'

// Shared options for the child forms (signup + parent dashboard "manage children").
export const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export const CHILD_INSTRUMENTS = [
  'Violin', 'Viola', 'Cello', 'Trumpet', 'Drums', 'Flute', 'Alto Saxophone', 'Tuba', 'Trombone', 'Other',
]

// Instruments a tutor can mark themselves proficient in (superset covering the roster).
export const TUTOR_INSTRUMENTS = [
  'Violin', 'Viola', 'Cello', 'Bass', 'Upright Bass', 'Guitar', 'Piano', 'Voice',
  'Flute', 'Clarinet', 'Alto Saxophone', 'Trumpet', 'Trombone', 'Tuba', 'Drums', 'Other',
]
