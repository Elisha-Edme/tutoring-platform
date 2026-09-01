export type Role = 'parent' | 'tutor' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  passwordHash: string
  createdAt: string
}

export interface Child {
  name: string
  grade: string
  instruments: string[]
}

export interface ParentProfile {
  userId: string
  email: string
  name: string
  children: Child[]
}

export interface TutorProfile {
  userId: string
  email: string
  name: string
  instruments: string[]
  bio: string
  school: string
  credentials: string
  location: string
  photoUrl: string
  lessonsCompleted: number
  hoursCompleted: number
  rating: number
}

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: Role
}

export interface TutorAvailabilityRule {
  id: string
  tutorUserId: string
  startTime: string         // HH:MM 24-hour
  endTime: string           // HH:MM 24-hour
  repeatType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  repeatInterval: number    // "every N [units]"
  repeatDays: string[]      // ['Mon','Wed','Fri'] for weekly; empty otherwise
  endsType: 'never' | 'on' | 'after'
  endsDate: string          // ISO date, only when endsType='on'; else ''
  endsAfterCount: number    // only when endsType='after'; else 0
  createdAt: string
}

export interface AvailabilityException {
  id: string
  tutorUserId: string
  startDate: string         // ISO date — first day of the blocked range
  endDate: string           // ISO date — last day of the blocked range (same as startDate for single-day blocks)
  type: 'blocked' | 'modified'
  startTime: string         // HH:MM, only when type='modified'; else ''
  endTime: string           // HH:MM, only when type='modified'; else ''
  createdAt: string
}

export interface LessonRequest {
  id: string
  parentUserId: string
  childName: string
  tutorUserId: string
  requestedDate: string       // ISO date YYYY-MM-DD
  requestedStartTime: string  // HH:MM
  requestedEndTime: string    // HH:MM
  message: string
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface TutorStudent {
  tutorUserId: string
  parentUserId: string
  childName: string
  addedAt: string
}

export interface Slot {
  date: string       // YYYY-MM-DD
  startTime: string  // HH:MM
  endTime: string    // HH:MM
}
