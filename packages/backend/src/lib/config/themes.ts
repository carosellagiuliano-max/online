/**
 * Theme Configuration System
 *
 * Configure via NEXT_PUBLIC_THEME in .env / .env.dev
 * Available themes: beauty, ocean, forest, midnight, dark, brownie
 *
 * To add a new theme:
 * 1. Add a new entry to the `themes` object below
 * 2. Define light and dark mode color values using OKLCH format
 * 3. Define layout options for structural differences
 * 4. The theme will automatically be available via the env variable
 *
 * NOTE: /admin routes are NOT affected by theme layouts - they use a fixed layout
 */

// ============================================
// LAYOUT CONFIGURATION
// Defines structural differences between themes
// ============================================

export type HeroStyle = 'centered' | 'split' | 'minimal' | 'video' | 'fullscreen'
export type ServicesStyle = 'cards' | 'list' | 'carousel' | 'grid'
export type GalleryStyle = 'masonry' | 'grid' | 'slider' | 'lightbox'
export type HeaderStyle = 'transparent' | 'solid' | 'minimal' | 'centered'
export type FooterStyle = 'full' | 'minimal' | 'centered' | 'columns'
export type CardStyle = 'elevated' | 'flat' | 'bordered' | 'glass'
export type ButtonStyle = 'rounded' | 'pill' | 'square' | 'minimal'

export interface ThemeLayout {
  // Page sections
  hero: HeroStyle
  services: ServicesStyle
  gallery: GalleryStyle

  // Navigation
  header: HeaderStyle
  footer: FooterStyle

  // Components
  cards: CardStyle
  buttons: ButtonStyle

  // Spacing & sizing
  sectionSpacing: 'compact' | 'normal' | 'relaxed'
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'

  // Effects
  animations: 'none' | 'subtle' | 'playful'
  glassmorphism: boolean
  gradients: boolean
}

// ============================================
// STRUCTURE PRESETS
// Separate from color themes - configured via NEXT_PUBLIC_THEME_STRUCTURE
// ============================================

export const structurePresets: Record<string, ThemeLayout> = {
  // Classic - Traditional elegant salon
  classic: {
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
  },

  // Modern - Clean split layouts
  modern: {
    hero: 'split',
    services: 'grid',
    gallery: 'slider',
    header: 'solid',
    footer: 'columns',
    cards: 'bordered',
    buttons: 'pill',
    sectionSpacing: 'relaxed',
    borderRadius: 'full',
    animations: 'playful',
    glassmorphism: false,
    gradients: true,
  },

  // Minimal - Simple, content-focused
  minimal: {
    hero: 'minimal',
    services: 'list',
    gallery: 'grid',
    header: 'minimal',
    footer: 'minimal',
    cards: 'flat',
    buttons: 'minimal',
    sectionSpacing: 'compact',
    borderRadius: 'sm',
    animations: 'none',
    glassmorphism: false,
    gradients: false,
  },

  // Bold - Full-screen immersive
  bold: {
    hero: 'fullscreen',
    services: 'carousel',
    gallery: 'lightbox',
    header: 'transparent',
    footer: 'centered',
    cards: 'glass',
    buttons: 'rounded',
    sectionSpacing: 'relaxed',
    borderRadius: 'lg',
    animations: 'playful',
    glassmorphism: true,
    gradients: true,
  },

  // Elegant - Sophisticated luxury
  elegant: {
    hero: 'video',
    services: 'cards',
    gallery: 'masonry',
    header: 'transparent',
    footer: 'full',
    cards: 'elevated',
    buttons: 'rounded',
    sectionSpacing: 'normal',
    borderRadius: 'md',
    animations: 'subtle',
    glassmorphism: true,
    gradients: true,
  },
}

// Default structure preset
export const DEFAULT_STRUCTURE = 'classic'

// Default layout configuration (for backwards compatibility)
export const defaultLayout: ThemeLayout = structurePresets.classic

export interface ThemeColors {
  // Brand colors
  gold: string
  goldLight: string
  goldDark: string
  rose: string
  roseLight: string
  roseDark: string
  cream: string
  charcoal: string

  // Core theme
  background: string
  foreground: string

  // Components
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  border: string
  input: string
  ring: string

  // Charts
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string

  // Sidebar
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing: string
}

export interface Theme {
  name: string
  displayName: string
  description: string
  light: ThemeColors
  dark: ThemeColors
  layout: ThemeLayout
}

export const themes: Record<string, Theme> = {
  // ============================================
  // BeautifyPRO - Rose Gold & Cream (Default)
  // Luxury beauty salon aesthetic
  // ============================================
  beauty: {
    name: 'beauty',
    displayName: 'BeautifyPRO',
    description: 'Elegant rose gold and cream - luxury salon aesthetic',
    layout: {
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
    },
    light: {
      gold: 'oklch(0.72 0.10 55)',
      goldLight: 'oklch(0.85 0.06 55)',
      goldDark: 'oklch(0.58 0.12 55)',
      rose: 'oklch(0.75 0.08 15)',
      roseLight: 'oklch(0.92 0.03 15)',
      roseDark: 'oklch(0.55 0.12 15)',
      cream: 'oklch(0.98 0.008 80)',
      charcoal: 'oklch(0.22 0.01 260)',

      background: 'oklch(0.993 0.003 80)',
      foreground: 'oklch(0.18 0.008 260)',
      card: 'oklch(0.998 0.002 80)',
      cardForeground: 'oklch(0.18 0.008 260)',
      popover: 'oklch(0.998 0.002 80)',
      popoverForeground: 'oklch(0.18 0.008 260)',
      primary: 'oklch(0.65 0.12 50)',
      primaryForeground: 'oklch(0.99 0.005 80)',
      secondary: 'oklch(0.96 0.015 15)',
      secondaryForeground: 'oklch(0.25 0.01 260)',
      muted: 'oklch(0.96 0.006 80)',
      mutedForeground: 'oklch(0.48 0.008 260)',
      accent: 'oklch(0.93 0.035 50)',
      accentForeground: 'oklch(0.25 0.01 260)',
      destructive: 'oklch(0.55 0.20 25)',
      border: 'oklch(0.91 0.008 80)',
      input: 'oklch(0.91 0.008 80)',
      ring: 'oklch(0.65 0.12 50)',

      chart1: 'oklch(0.65 0.12 50)',
      chart2: 'oklch(0.70 0.08 15)',
      chart3: 'oklch(0.62 0.10 160)',
      chart4: 'oklch(0.68 0.12 280)',
      chart5: 'oklch(0.58 0.10 100)',

      sidebar: 'oklch(0.98 0.005 80)',
      sidebarForeground: 'oklch(0.18 0.008 260)',
      sidebarPrimary: 'oklch(0.65 0.12 50)',
      sidebarPrimaryForeground: 'oklch(0.99 0.005 80)',
      sidebarAccent: 'oklch(0.94 0.03 50)',
      sidebarAccentForeground: 'oklch(0.25 0.01 260)',
      sidebarBorder: 'oklch(0.91 0.008 80)',
      sidebarRing: 'oklch(0.65 0.12 50)',
    },
    dark: {
      gold: 'oklch(0.72 0.10 55)',
      goldLight: 'oklch(0.85 0.06 55)',
      goldDark: 'oklch(0.58 0.12 55)',
      rose: 'oklch(0.75 0.08 15)',
      roseLight: 'oklch(0.92 0.03 15)',
      roseDark: 'oklch(0.55 0.12 15)',
      cream: 'oklch(0.98 0.008 80)',
      charcoal: 'oklch(0.22 0.01 260)',

      background: 'oklch(0.12 0.008 260)',
      foreground: 'oklch(0.95 0.005 80)',
      card: 'oklch(0.16 0.008 260)',
      cardForeground: 'oklch(0.95 0.005 80)',
      popover: 'oklch(0.16 0.008 260)',
      popoverForeground: 'oklch(0.95 0.005 80)',
      primary: 'oklch(0.72 0.14 50)',
      primaryForeground: 'oklch(0.12 0.008 260)',
      secondary: 'oklch(0.22 0.015 15)',
      secondaryForeground: 'oklch(0.95 0.005 80)',
      muted: 'oklch(0.22 0.008 260)',
      mutedForeground: 'oklch(0.62 0.008 80)',
      accent: 'oklch(0.28 0.04 50)',
      accentForeground: 'oklch(0.95 0.005 80)',
      destructive: 'oklch(0.62 0.18 25)',
      border: 'oklch(0.26 0.008 260)',
      input: 'oklch(0.26 0.008 260)',
      ring: 'oklch(0.72 0.14 50)',

      chart1: 'oklch(0.72 0.14 50)',
      chart2: 'oklch(0.75 0.10 15)',
      chart3: 'oklch(0.70 0.12 160)',
      chart4: 'oklch(0.72 0.14 280)',
      chart5: 'oklch(0.68 0.12 100)',

      sidebar: 'oklch(0.14 0.008 260)',
      sidebarForeground: 'oklch(0.95 0.005 80)',
      sidebarPrimary: 'oklch(0.72 0.14 50)',
      sidebarPrimaryForeground: 'oklch(0.12 0.008 260)',
      sidebarAccent: 'oklch(0.24 0.03 50)',
      sidebarAccentForeground: 'oklch(0.95 0.005 80)',
      sidebarBorder: 'oklch(0.26 0.008 260)',
      sidebarRing: 'oklch(0.72 0.14 50)',
    },
  },

  // ============================================
  // OCEAN - Modern Blue & Teal
  // Fresh, clean, professional spa feel
  // ============================================
  ocean: {
    name: 'ocean',
    displayName: 'Ocean',
    description: 'Fresh blue and teal - modern spa aesthetic',
    layout: {
      hero: 'split',
      services: 'grid',
      gallery: 'slider',
      header: 'solid',
      footer: 'columns',
      cards: 'bordered',
      buttons: 'pill',
      sectionSpacing: 'relaxed',
      borderRadius: 'full',
      animations: 'playful',
      glassmorphism: false,
      gradients: true,
    },
    light: {
      gold: 'oklch(0.65 0.14 230)',      // Ocean blue
      goldLight: 'oklch(0.80 0.08 230)',
      goldDark: 'oklch(0.50 0.16 230)',
      rose: 'oklch(0.70 0.12 195)',       // Teal accent
      roseLight: 'oklch(0.90 0.04 195)',
      roseDark: 'oklch(0.50 0.14 195)',
      cream: 'oklch(0.98 0.005 230)',     // Cool white
      charcoal: 'oklch(0.20 0.02 230)',   // Blue-gray

      background: 'oklch(0.99 0.003 230)',
      foreground: 'oklch(0.18 0.015 230)',
      card: 'oklch(0.998 0.002 230)',
      cardForeground: 'oklch(0.18 0.015 230)',
      popover: 'oklch(0.998 0.002 230)',
      popoverForeground: 'oklch(0.18 0.015 230)',
      primary: 'oklch(0.55 0.16 230)',
      primaryForeground: 'oklch(0.99 0.005 230)',
      secondary: 'oklch(0.95 0.02 195)',
      secondaryForeground: 'oklch(0.25 0.02 230)',
      muted: 'oklch(0.96 0.008 230)',
      mutedForeground: 'oklch(0.50 0.015 230)',
      accent: 'oklch(0.92 0.04 195)',
      accentForeground: 'oklch(0.25 0.02 230)',
      destructive: 'oklch(0.55 0.20 25)',
      border: 'oklch(0.90 0.01 230)',
      input: 'oklch(0.90 0.01 230)',
      ring: 'oklch(0.55 0.16 230)',

      chart1: 'oklch(0.55 0.16 230)',
      chart2: 'oklch(0.60 0.14 195)',
      chart3: 'oklch(0.55 0.12 160)',
      chart4: 'oklch(0.60 0.14 260)',
      chart5: 'oklch(0.50 0.10 280)',

      sidebar: 'oklch(0.97 0.006 230)',
      sidebarForeground: 'oklch(0.18 0.015 230)',
      sidebarPrimary: 'oklch(0.55 0.16 230)',
      sidebarPrimaryForeground: 'oklch(0.99 0.005 230)',
      sidebarAccent: 'oklch(0.92 0.04 195)',
      sidebarAccentForeground: 'oklch(0.25 0.02 230)',
      sidebarBorder: 'oklch(0.90 0.01 230)',
      sidebarRing: 'oklch(0.55 0.16 230)',
    },
    dark: {
      gold: 'oklch(0.65 0.14 230)',
      goldLight: 'oklch(0.80 0.08 230)',
      goldDark: 'oklch(0.50 0.16 230)',
      rose: 'oklch(0.70 0.12 195)',
      roseLight: 'oklch(0.90 0.04 195)',
      roseDark: 'oklch(0.50 0.14 195)',
      cream: 'oklch(0.98 0.005 230)',
      charcoal: 'oklch(0.20 0.02 230)',

      background: 'oklch(0.12 0.015 230)',
      foreground: 'oklch(0.95 0.005 230)',
      card: 'oklch(0.16 0.015 230)',
      cardForeground: 'oklch(0.95 0.005 230)',
      popover: 'oklch(0.16 0.015 230)',
      popoverForeground: 'oklch(0.95 0.005 230)',
      primary: 'oklch(0.65 0.16 230)',
      primaryForeground: 'oklch(0.12 0.015 230)',
      secondary: 'oklch(0.22 0.02 195)',
      secondaryForeground: 'oklch(0.95 0.005 230)',
      muted: 'oklch(0.22 0.015 230)',
      mutedForeground: 'oklch(0.60 0.01 230)',
      accent: 'oklch(0.28 0.05 195)',
      accentForeground: 'oklch(0.95 0.005 230)',
      destructive: 'oklch(0.62 0.18 25)',
      border: 'oklch(0.26 0.015 230)',
      input: 'oklch(0.26 0.015 230)',
      ring: 'oklch(0.65 0.16 230)',

      chart1: 'oklch(0.65 0.16 230)',
      chart2: 'oklch(0.70 0.14 195)',
      chart3: 'oklch(0.65 0.12 160)',
      chart4: 'oklch(0.70 0.14 260)',
      chart5: 'oklch(0.60 0.10 280)',

      sidebar: 'oklch(0.14 0.015 230)',
      sidebarForeground: 'oklch(0.95 0.005 230)',
      sidebarPrimary: 'oklch(0.65 0.16 230)',
      sidebarPrimaryForeground: 'oklch(0.12 0.015 230)',
      sidebarAccent: 'oklch(0.26 0.04 195)',
      sidebarAccentForeground: 'oklch(0.95 0.005 230)',
      sidebarBorder: 'oklch(0.26 0.015 230)',
      sidebarRing: 'oklch(0.65 0.16 230)',
    },
  },

  // ============================================
  // FOREST - Natural Green & Earth
  // Organic, calming, natural spa aesthetic
  // ============================================
  forest: {
    name: 'forest',
    displayName: 'Forest',
    description: 'Natural green and earth tones - organic spa aesthetic',
    layout: {
      hero: 'fullscreen',
      services: 'list',
      gallery: 'masonry',
      header: 'minimal',
      footer: 'minimal',
      cards: 'flat',
      buttons: 'square',
      sectionSpacing: 'relaxed',
      borderRadius: 'sm',
      animations: 'subtle',
      glassmorphism: false,
      gradients: false,
    },
    light: {
      gold: 'oklch(0.58 0.12 145)',      // Forest green
      goldLight: 'oklch(0.75 0.08 145)',
      goldDark: 'oklch(0.45 0.14 145)',
      rose: 'oklch(0.65 0.08 85)',        // Warm earth/sage
      roseLight: 'oklch(0.88 0.03 85)',
      roseDark: 'oklch(0.48 0.10 85)',
      cream: 'oklch(0.98 0.008 100)',     // Warm cream
      charcoal: 'oklch(0.22 0.015 145)',  // Deep forest

      background: 'oklch(0.99 0.004 100)',
      foreground: 'oklch(0.20 0.02 145)',
      card: 'oklch(0.998 0.003 100)',
      cardForeground: 'oklch(0.20 0.02 145)',
      popover: 'oklch(0.998 0.003 100)',
      popoverForeground: 'oklch(0.20 0.02 145)',
      primary: 'oklch(0.52 0.13 145)',
      primaryForeground: 'oklch(0.99 0.005 100)',
      secondary: 'oklch(0.95 0.02 85)',
      secondaryForeground: 'oklch(0.28 0.02 145)',
      muted: 'oklch(0.95 0.008 100)',
      mutedForeground: 'oklch(0.48 0.015 145)',
      accent: 'oklch(0.90 0.04 85)',
      accentForeground: 'oklch(0.28 0.02 145)',
      destructive: 'oklch(0.55 0.20 25)',
      border: 'oklch(0.90 0.01 100)',
      input: 'oklch(0.90 0.01 100)',
      ring: 'oklch(0.52 0.13 145)',

      chart1: 'oklch(0.52 0.13 145)',
      chart2: 'oklch(0.58 0.10 85)',
      chart3: 'oklch(0.48 0.12 180)',
      chart4: 'oklch(0.55 0.10 45)',
      chart5: 'oklch(0.45 0.08 200)',

      sidebar: 'oklch(0.97 0.006 100)',
      sidebarForeground: 'oklch(0.20 0.02 145)',
      sidebarPrimary: 'oklch(0.52 0.13 145)',
      sidebarPrimaryForeground: 'oklch(0.99 0.005 100)',
      sidebarAccent: 'oklch(0.90 0.04 85)',
      sidebarAccentForeground: 'oklch(0.28 0.02 145)',
      sidebarBorder: 'oklch(0.90 0.01 100)',
      sidebarRing: 'oklch(0.52 0.13 145)',
    },
    dark: {
      gold: 'oklch(0.58 0.12 145)',
      goldLight: 'oklch(0.75 0.08 145)',
      goldDark: 'oklch(0.45 0.14 145)',
      rose: 'oklch(0.65 0.08 85)',
      roseLight: 'oklch(0.88 0.03 85)',
      roseDark: 'oklch(0.48 0.10 85)',
      cream: 'oklch(0.98 0.008 100)',
      charcoal: 'oklch(0.22 0.015 145)',

      background: 'oklch(0.13 0.015 145)',
      foreground: 'oklch(0.94 0.006 100)',
      card: 'oklch(0.17 0.015 145)',
      cardForeground: 'oklch(0.94 0.006 100)',
      popover: 'oklch(0.17 0.015 145)',
      popoverForeground: 'oklch(0.94 0.006 100)',
      primary: 'oklch(0.62 0.14 145)',
      primaryForeground: 'oklch(0.13 0.015 145)',
      secondary: 'oklch(0.24 0.02 85)',
      secondaryForeground: 'oklch(0.94 0.006 100)',
      muted: 'oklch(0.23 0.012 145)',
      mutedForeground: 'oklch(0.58 0.01 100)',
      accent: 'oklch(0.28 0.04 85)',
      accentForeground: 'oklch(0.94 0.006 100)',
      destructive: 'oklch(0.62 0.18 25)',
      border: 'oklch(0.27 0.012 145)',
      input: 'oklch(0.27 0.012 145)',
      ring: 'oklch(0.62 0.14 145)',

      chart1: 'oklch(0.62 0.14 145)',
      chart2: 'oklch(0.65 0.10 85)',
      chart3: 'oklch(0.58 0.12 180)',
      chart4: 'oklch(0.62 0.10 45)',
      chart5: 'oklch(0.55 0.08 200)',

      sidebar: 'oklch(0.15 0.015 145)',
      sidebarForeground: 'oklch(0.94 0.006 100)',
      sidebarPrimary: 'oklch(0.62 0.14 145)',
      sidebarPrimaryForeground: 'oklch(0.13 0.015 145)',
      sidebarAccent: 'oklch(0.26 0.035 85)',
      sidebarAccentForeground: 'oklch(0.94 0.006 100)',
      sidebarBorder: 'oklch(0.27 0.012 145)',
      sidebarRing: 'oklch(0.62 0.14 145)',
    },
  },

  // ============================================
  // MIDNIGHT - Elegant Purple & Violet
  // Sophisticated, luxurious, modern aesthetic
  // ============================================
  midnight: {
    name: 'midnight',
    displayName: 'Midnight',
    description: 'Elegant purple and violet - sophisticated luxury aesthetic',
    layout: {
      hero: 'video',
      services: 'carousel',
      gallery: 'lightbox',
      header: 'transparent',
      footer: 'centered',
      cards: 'glass',
      buttons: 'rounded',
      sectionSpacing: 'normal',
      borderRadius: 'lg',
      animations: 'playful',
      glassmorphism: true,
      gradients: true,
    },
    light: {
      gold: 'oklch(0.55 0.18 300)',       // Rich purple
      goldLight: 'oklch(0.75 0.12 300)',
      goldDark: 'oklch(0.42 0.20 300)',
      rose: 'oklch(0.60 0.14 330)',        // Soft violet/pink
      roseLight: 'oklch(0.88 0.06 330)',
      roseDark: 'oklch(0.45 0.16 330)',
      cream: 'oklch(0.98 0.006 300)',      // Cool off-white
      charcoal: 'oklch(0.18 0.02 300)',    // Deep purple-black

      background: 'oklch(0.99 0.004 300)',
      foreground: 'oklch(0.18 0.02 300)',
      card: 'oklch(0.998 0.003 300)',
      cardForeground: 'oklch(0.18 0.02 300)',
      popover: 'oklch(0.998 0.003 300)',
      popoverForeground: 'oklch(0.18 0.02 300)',
      primary: 'oklch(0.50 0.20 300)',
      primaryForeground: 'oklch(0.99 0.005 300)',
      secondary: 'oklch(0.95 0.025 330)',
      secondaryForeground: 'oklch(0.25 0.02 300)',
      muted: 'oklch(0.96 0.008 300)',
      mutedForeground: 'oklch(0.48 0.015 300)',
      accent: 'oklch(0.92 0.045 330)',
      accentForeground: 'oklch(0.25 0.02 300)',
      destructive: 'oklch(0.55 0.20 25)',
      border: 'oklch(0.91 0.012 300)',
      input: 'oklch(0.91 0.012 300)',
      ring: 'oklch(0.50 0.20 300)',

      chart1: 'oklch(0.50 0.20 300)',
      chart2: 'oklch(0.55 0.16 330)',
      chart3: 'oklch(0.52 0.14 260)',
      chart4: 'oklch(0.58 0.12 350)',
      chart5: 'oklch(0.48 0.10 280)',

      sidebar: 'oklch(0.98 0.006 300)',
      sidebarForeground: 'oklch(0.18 0.02 300)',
      sidebarPrimary: 'oklch(0.50 0.20 300)',
      sidebarPrimaryForeground: 'oklch(0.99 0.005 300)',
      sidebarAccent: 'oklch(0.92 0.045 330)',
      sidebarAccentForeground: 'oklch(0.25 0.02 300)',
      sidebarBorder: 'oklch(0.91 0.012 300)',
      sidebarRing: 'oklch(0.50 0.20 300)',
    },
    dark: {
      gold: 'oklch(0.55 0.18 300)',
      goldLight: 'oklch(0.75 0.12 300)',
      goldDark: 'oklch(0.42 0.20 300)',
      rose: 'oklch(0.60 0.14 330)',
      roseLight: 'oklch(0.88 0.06 330)',
      roseDark: 'oklch(0.45 0.16 330)',
      cream: 'oklch(0.98 0.006 300)',
      charcoal: 'oklch(0.18 0.02 300)',

      background: 'oklch(0.11 0.02 300)',
      foreground: 'oklch(0.95 0.006 300)',
      card: 'oklch(0.15 0.02 300)',
      cardForeground: 'oklch(0.95 0.006 300)',
      popover: 'oklch(0.15 0.02 300)',
      popoverForeground: 'oklch(0.95 0.006 300)',
      primary: 'oklch(0.62 0.20 300)',
      primaryForeground: 'oklch(0.11 0.02 300)',
      secondary: 'oklch(0.22 0.025 330)',
      secondaryForeground: 'oklch(0.95 0.006 300)',
      muted: 'oklch(0.20 0.015 300)',
      mutedForeground: 'oklch(0.60 0.01 300)',
      accent: 'oklch(0.26 0.05 330)',
      accentForeground: 'oklch(0.95 0.006 300)',
      destructive: 'oklch(0.62 0.18 25)',
      border: 'oklch(0.25 0.018 300)',
      input: 'oklch(0.25 0.018 300)',
      ring: 'oklch(0.62 0.20 300)',

      chart1: 'oklch(0.62 0.20 300)',
      chart2: 'oklch(0.65 0.16 330)',
      chart3: 'oklch(0.60 0.14 260)',
      chart4: 'oklch(0.65 0.12 350)',
      chart5: 'oklch(0.58 0.10 280)',

      sidebar: 'oklch(0.13 0.02 300)',
      sidebarForeground: 'oklch(0.95 0.006 300)',
      sidebarPrimary: 'oklch(0.62 0.20 300)',
      sidebarPrimaryForeground: 'oklch(0.11 0.02 300)',
      sidebarAccent: 'oklch(0.24 0.04 330)',
      sidebarAccentForeground: 'oklch(0.95 0.006 300)',
      sidebarBorder: 'oklch(0.25 0.018 300)',
      sidebarRing: 'oklch(0.62 0.20 300)',
    },
  },

  // ============================================
  // DARK - Sleek Dark Mode
  // Modern, minimal, always-dark aesthetic
  // ============================================
  dark: {
    name: 'dark',
    displayName: 'Dark',
    description: 'Sleek dark mode - modern minimal aesthetic',
    layout: {
      hero: 'minimal',
      services: 'grid',
      gallery: 'grid',
      header: 'solid',
      footer: 'minimal',
      cards: 'flat',
      buttons: 'minimal',
      sectionSpacing: 'compact',
      borderRadius: 'sm',
      animations: 'none',
      glassmorphism: false,
      gradients: false,
    },
    light: {
      // Dark theme uses dark colors even in "light" mode
      gold: 'oklch(0.70 0.12 250)',        // Cool blue accent
      goldLight: 'oklch(0.82 0.08 250)',
      goldDark: 'oklch(0.55 0.14 250)',
      rose: 'oklch(0.65 0.10 280)',         // Subtle purple accent
      roseLight: 'oklch(0.80 0.06 280)',
      roseDark: 'oklch(0.50 0.12 280)',
      cream: 'oklch(0.92 0.005 250)',       // Light gray
      charcoal: 'oklch(0.12 0.01 250)',     // Near black

      background: 'oklch(0.14 0.008 250)',
      foreground: 'oklch(0.92 0.005 250)',
      card: 'oklch(0.18 0.008 250)',
      cardForeground: 'oklch(0.92 0.005 250)',
      popover: 'oklch(0.18 0.008 250)',
      popoverForeground: 'oklch(0.92 0.005 250)',
      primary: 'oklch(0.70 0.12 250)',
      primaryForeground: 'oklch(0.12 0.008 250)',
      secondary: 'oklch(0.22 0.008 250)',
      secondaryForeground: 'oklch(0.88 0.005 250)',
      muted: 'oklch(0.22 0.006 250)',
      mutedForeground: 'oklch(0.60 0.008 250)',
      accent: 'oklch(0.26 0.03 280)',
      accentForeground: 'oklch(0.92 0.005 250)',
      destructive: 'oklch(0.60 0.20 25)',
      border: 'oklch(0.26 0.008 250)',
      input: 'oklch(0.26 0.008 250)',
      ring: 'oklch(0.70 0.12 250)',

      chart1: 'oklch(0.70 0.12 250)',
      chart2: 'oklch(0.65 0.10 280)',
      chart3: 'oklch(0.60 0.12 200)',
      chart4: 'oklch(0.68 0.10 320)',
      chart5: 'oklch(0.55 0.08 170)',

      sidebar: 'oklch(0.12 0.008 250)',
      sidebarForeground: 'oklch(0.92 0.005 250)',
      sidebarPrimary: 'oklch(0.70 0.12 250)',
      sidebarPrimaryForeground: 'oklch(0.12 0.008 250)',
      sidebarAccent: 'oklch(0.22 0.025 280)',
      sidebarAccentForeground: 'oklch(0.92 0.005 250)',
      sidebarBorder: 'oklch(0.24 0.008 250)',
      sidebarRing: 'oklch(0.70 0.12 250)',
    },
    dark: {
      // Same as light mode for consistent dark appearance
      gold: 'oklch(0.70 0.12 250)',
      goldLight: 'oklch(0.82 0.08 250)',
      goldDark: 'oklch(0.55 0.14 250)',
      rose: 'oklch(0.65 0.10 280)',
      roseLight: 'oklch(0.80 0.06 280)',
      roseDark: 'oklch(0.50 0.12 280)',
      cream: 'oklch(0.92 0.005 250)',
      charcoal: 'oklch(0.12 0.01 250)',

      background: 'oklch(0.10 0.008 250)',
      foreground: 'oklch(0.92 0.005 250)',
      card: 'oklch(0.14 0.008 250)',
      cardForeground: 'oklch(0.92 0.005 250)',
      popover: 'oklch(0.14 0.008 250)',
      popoverForeground: 'oklch(0.92 0.005 250)',
      primary: 'oklch(0.72 0.14 250)',
      primaryForeground: 'oklch(0.10 0.008 250)',
      secondary: 'oklch(0.20 0.008 250)',
      secondaryForeground: 'oklch(0.90 0.005 250)',
      muted: 'oklch(0.20 0.006 250)',
      mutedForeground: 'oklch(0.58 0.008 250)',
      accent: 'oklch(0.24 0.03 280)',
      accentForeground: 'oklch(0.92 0.005 250)',
      destructive: 'oklch(0.62 0.20 25)',
      border: 'oklch(0.24 0.008 250)',
      input: 'oklch(0.24 0.008 250)',
      ring: 'oklch(0.72 0.14 250)',

      chart1: 'oklch(0.72 0.14 250)',
      chart2: 'oklch(0.68 0.12 280)',
      chart3: 'oklch(0.62 0.14 200)',
      chart4: 'oklch(0.70 0.12 320)',
      chart5: 'oklch(0.58 0.10 170)',

      sidebar: 'oklch(0.10 0.008 250)',
      sidebarForeground: 'oklch(0.92 0.005 250)',
      sidebarPrimary: 'oklch(0.72 0.14 250)',
      sidebarPrimaryForeground: 'oklch(0.10 0.008 250)',
      sidebarAccent: 'oklch(0.20 0.025 280)',
      sidebarAccentForeground: 'oklch(0.92 0.005 250)',
      sidebarBorder: 'oklch(0.22 0.008 250)',
      sidebarRing: 'oklch(0.72 0.14 250)',
    },
  },

  // ============================================
  // BROWNIE - Warm Chocolate & Caramel
  // Cozy, warm, inviting coffee shop aesthetic
  // ============================================
  brownie: {
    name: 'brownie',
    displayName: 'Brownie',
    description: 'Warm chocolate and caramel - cozy inviting aesthetic',
    layout: {
      hero: 'split',
      services: 'cards',
      gallery: 'masonry',
      header: 'solid',
      footer: 'full',
      cards: 'elevated',
      buttons: 'rounded',
      sectionSpacing: 'normal',
      borderRadius: 'md',
      animations: 'subtle',
      glassmorphism: false,
      gradients: true,
    },
    light: {
      gold: 'oklch(0.55 0.12 45)',         // Rich caramel
      goldLight: 'oklch(0.72 0.08 45)',
      goldDark: 'oklch(0.42 0.14 45)',
      rose: 'oklch(0.50 0.10 30)',          // Warm chocolate
      roseLight: 'oklch(0.75 0.05 30)',
      roseDark: 'oklch(0.38 0.12 30)',
      cream: 'oklch(0.96 0.015 60)',        // Warm cream
      charcoal: 'oklch(0.25 0.03 30)',      // Dark chocolate

      background: 'oklch(0.98 0.008 60)',
      foreground: 'oklch(0.25 0.04 30)',
      card: 'oklch(0.99 0.006 60)',
      cardForeground: 'oklch(0.25 0.04 30)',
      popover: 'oklch(0.99 0.006 60)',
      popoverForeground: 'oklch(0.25 0.04 30)',
      primary: 'oklch(0.50 0.12 45)',
      primaryForeground: 'oklch(0.98 0.008 60)',
      secondary: 'oklch(0.92 0.03 45)',
      secondaryForeground: 'oklch(0.30 0.04 30)',
      muted: 'oklch(0.94 0.012 60)',
      mutedForeground: 'oklch(0.50 0.03 30)',
      accent: 'oklch(0.88 0.05 45)',
      accentForeground: 'oklch(0.30 0.04 30)',
      destructive: 'oklch(0.55 0.20 25)',
      border: 'oklch(0.88 0.02 60)',
      input: 'oklch(0.88 0.02 60)',
      ring: 'oklch(0.50 0.12 45)',

      chart1: 'oklch(0.50 0.12 45)',
      chart2: 'oklch(0.45 0.10 30)',
      chart3: 'oklch(0.55 0.08 70)',
      chart4: 'oklch(0.48 0.12 15)',
      chart5: 'oklch(0.42 0.06 55)',

      sidebar: 'oklch(0.96 0.01 60)',
      sidebarForeground: 'oklch(0.25 0.04 30)',
      sidebarPrimary: 'oklch(0.50 0.12 45)',
      sidebarPrimaryForeground: 'oklch(0.98 0.008 60)',
      sidebarAccent: 'oklch(0.90 0.04 45)',
      sidebarAccentForeground: 'oklch(0.30 0.04 30)',
      sidebarBorder: 'oklch(0.88 0.02 60)',
      sidebarRing: 'oklch(0.50 0.12 45)',
    },
    dark: {
      gold: 'oklch(0.62 0.12 45)',
      goldLight: 'oklch(0.75 0.08 45)',
      goldDark: 'oklch(0.48 0.14 45)',
      rose: 'oklch(0.55 0.10 30)',
      roseLight: 'oklch(0.78 0.05 30)',
      roseDark: 'oklch(0.42 0.12 30)',
      cream: 'oklch(0.96 0.015 60)',
      charcoal: 'oklch(0.25 0.03 30)',

      background: 'oklch(0.16 0.025 30)',
      foreground: 'oklch(0.92 0.012 60)',
      card: 'oklch(0.20 0.025 30)',
      cardForeground: 'oklch(0.92 0.012 60)',
      popover: 'oklch(0.20 0.025 30)',
      popoverForeground: 'oklch(0.92 0.012 60)',
      primary: 'oklch(0.65 0.14 45)',
      primaryForeground: 'oklch(0.16 0.025 30)',
      secondary: 'oklch(0.26 0.03 30)',
      secondaryForeground: 'oklch(0.90 0.012 60)',
      muted: 'oklch(0.24 0.02 30)',
      mutedForeground: 'oklch(0.62 0.02 60)',
      accent: 'oklch(0.30 0.05 45)',
      accentForeground: 'oklch(0.92 0.012 60)',
      destructive: 'oklch(0.62 0.18 25)',
      border: 'oklch(0.30 0.02 30)',
      input: 'oklch(0.30 0.02 30)',
      ring: 'oklch(0.65 0.14 45)',

      chart1: 'oklch(0.65 0.14 45)',
      chart2: 'oklch(0.55 0.12 30)',
      chart3: 'oklch(0.60 0.10 70)',
      chart4: 'oklch(0.58 0.14 15)',
      chart5: 'oklch(0.50 0.08 55)',

      sidebar: 'oklch(0.14 0.025 30)',
      sidebarForeground: 'oklch(0.92 0.012 60)',
      sidebarPrimary: 'oklch(0.65 0.14 45)',
      sidebarPrimaryForeground: 'oklch(0.14 0.025 30)',
      sidebarAccent: 'oklch(0.28 0.04 45)',
      sidebarAccentForeground: 'oklch(0.92 0.012 60)',
      sidebarBorder: 'oklch(0.28 0.02 30)',
      sidebarRing: 'oklch(0.65 0.14 45)',
    },
  },
}

// Default theme if env variable is not set or invalid
export const DEFAULT_THEME = 'beauty'

// Get theme from environment variable
export function getThemeName(): string {
  const themeName = process.env.NEXT_PUBLIC_THEME || DEFAULT_THEME
  return themes[themeName] ? themeName : DEFAULT_THEME
}

// Get theme configuration
export function getTheme(): Theme {
  return themes[getThemeName()]
}

// Get list of available color themes
export function getAvailableThemes(): Theme[] {
  return Object.values(themes)
}

// Get list of available structure presets
export function getAvailableStructures(): { name: string; layout: ThemeLayout }[] {
  return Object.entries(structurePresets).map(([name, layout]) => ({ name, layout }))
}

// ============================================
// STRUCTURE CONFIGURATION
// Separate from color themes
// ============================================

// Get structure preset name from environment variable
export function getStructureName(): string {
  const structureName = process.env.NEXT_PUBLIC_THEME_STRUCTURE || DEFAULT_STRUCTURE
  return structurePresets[structureName] ? structureName : DEFAULT_STRUCTURE
}

// Get structure preset configuration
export function getStructure(): ThemeLayout {
  return structurePresets[getStructureName()]
}

// Get theme layout configuration (uses structure preset, NOT theme's built-in layout)
export function getThemeLayout(): ThemeLayout {
  return getStructure()
}
