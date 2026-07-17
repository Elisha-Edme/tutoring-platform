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
  instrument: string
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
  sessionCount: number
  rating: number
}

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: Role
}
