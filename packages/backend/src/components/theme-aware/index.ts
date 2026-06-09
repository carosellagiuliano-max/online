// ============================================
// THEME-AWARE COMPONENTS
// Components that adapt their structure based on theme configuration
//
// Configuration:
//   NEXT_PUBLIC_THEME          - Controls colors (beauty, ocean, forest, etc.)
//   NEXT_PUBLIC_THEME_STRUCTURE - Controls layout (classic, modern, minimal, bold, elegant)
//
// NOTE: These components are for customer-facing pages ONLY
//       /admin routes use fixed layouts and are not affected
// ============================================

// Page sections
export { HeroSection } from './hero-section'
export { ServicesSection, type Service } from './services-section'
export { GallerySection, type GalleryImage } from './gallery-section'

// Utility components
export {
  ThemeCard,
  ThemeSection,
  ThemeGradient,
  ThemeGlass,
  useThemeButtonClasses,
  type ThemeCardProps,
  type ThemeSectionProps,
  type ThemeGradientProps,
  type ThemeGlassProps,
} from './theme-card'
