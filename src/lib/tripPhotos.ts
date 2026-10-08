'use client'

import { createContext } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

// The iPhone app's PostcardPhotos plugin (ios/App/App/PostcardPhotos.swift): photos from the library by date, so
// adding photos to an old trip can start at that trip's photos instead of the whole library.
export type LibraryPhoto = { id: string; date?: string; lat?: number; lng?: number }
type PostcardPhotosPlugin = {
  photosBetween(options: { start: string; end: string; limit?: number }): Promise<{ access: 'all' | 'limited' | 'denied'; photos: LibraryPhoto[] }>
  thumbnails(options: { ids: string[]; size?: number }): Promise<{ thumbnails: Record<string, string> }>
  photo(options: { id: string; maxSize?: number }): Promise<{ data: string; mimeType: string }>
}
export const PostcardPhotos = registerPlugin<PostcardPhotosPlugin>('PostcardPhotos')

// Only in the iPhone app. Builds from before the plugin answer "not implemented"; callers fall back to the usual picker.
export const canPickTripPhotos = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

// The trip being edited (first and last day, YYYY-MM-DD), when it has real dates. Set by the planner and trip page.
export const TripDates = createContext<{ start: string; end: string } | null>(null)
