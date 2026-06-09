'use client'

import { createContext, useContext, ReactNode } from 'react'

// ============================================
// THEME LAYOUT CONTEXT
// Provides structural theme configuration to client components
// NOTE: This does NOT affect /admin routes
// ============================================

// Layout types (mirrored from frontend config/themes.ts)
export type HeroStyle = 'centered' | 'split' | 'minimal' | 'video' | 'fullscreen'
export type ServicesStyle = 'cards' | 'list' | 'carousel' | 'grid'
export type GalleryStyle = 'masonry' | 'grid' | 'slider' | 'lightbox'
export type HeaderStyle = 'transparent' | 'solid' | 'minimal' | 'centered'
export type FooterStyle = 'full' | 'minimal' | 'centered' | 'columns'
export type CardStyle = 'elevated' | 'flat' | 'bordered' | 'glass'
export type ButtonStyle = 'rounded' | 'pill' | 'square' | 'minimal'

export interface ThemeLayout {
  hero: HeroStyle
  services: ServicesStyle
  gallery: GalleryStyle
  header: HeaderStyle
  footer: FooterStyle
  cards: CardStyle
  buttons: ButtonStyle
  sectionSpacing: 'compact' | 'normal' | 'relaxed'
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'
  animations: 'none' | 'subtle' | 'playful'
  glassmorphism: boolean
  gradients: boolean
}

// Default layout (classic preset)
const defaultLayout: ThemeLayout = {
  hero: 'centered',
  services: 'cards',
  gallery: 'masonry',
  header: 'transparent',
  footer: 'full',
  cards: 'elevated',
  buttons: 'rounded',
  sectionSpacing: 'normal',
  borderRadius: 'lg',
  animations: 'subtle',
  glassmorphism: true,
  gradients: true,
}

interface ThemeLayoutContextType {
  layout: ThemeLayout
  themeName: string
}

const ThemeLayoutContext = createContext<ThemeLayoutContextType>({
  layout: defaultLayout,
  themeName: 'beauty',
})

interface ThemeLayoutProviderProps {
  children: ReactNode
  layout: ThemeLayout
  themeName: string
}

export function ThemeLayoutProvider({ children, layout, themeName }: ThemeLayoutProviderProps) {
  return (
    <ThemeLayoutContext.Provider value={{ layout, themeName }}>
      {children}
    </ThemeLayoutContext.Provider>
  )
}

// Hook to access theme layout in client components
export function useThemeLayout() {
  const context = useContext(ThemeLayoutContext)
  if (!context) {
    throw new Error('useThemeLayout must be used within a ThemeLayoutProvider')
  }
  return context
}

// Utility hooks for specific layout values
export function useHeroStyle() {
  return useThemeLayout().layout.hero
}

export function useServicesStyle() {
  return useThemeLayout().layout.services
}

export function useGalleryStyle() {
  return useThemeLayout().layout.gallery
}

export function useHeaderStyle() {
  return useThemeLayout().layout.header
}

export function useFooterStyle() {
  return useThemeLayout().layout.footer
}

export function useCardStyle() {
  return useThemeLayout().layout.cards
}

export function useButtonStyle() {
  return useThemeLayout().layout.buttons
}
