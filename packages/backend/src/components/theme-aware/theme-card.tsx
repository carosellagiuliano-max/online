'use client'

import { forwardRef, HTMLAttributes } from 'react'
import { useThemeLayout } from '@/contexts/theme-layout-context'
import { cn } from '@/lib/utils'

// ============================================
// THEME-AWARE CARD COMPONENT
// Automatically applies card styling based on theme structure
// ============================================

export interface ThemeCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export const ThemeCard = forwardRef<HTMLDivElement, ThemeCardProps>(
  ({ className, hover = true, padding = 'md', children, ...props }, ref) => {
    const { layout } = useThemeLayout()

    const cardStyles = {
      elevated: 'shadow-elegant bg-card',
      flat: 'bg-muted/50',
      bordered: 'border-2 border-border bg-transparent',
      glass: 'glass backdrop-blur-md bg-card/80',
    }

    const hoverStyles = {
      elevated: 'hover:shadow-elegant-lg hover:-translate-y-1',
      flat: 'hover:bg-muted',
      bordered: 'hover:border-primary',
      glass: 'hover:glass-strong hover:bg-card/90',
    }

    const radiusStyles = {
      none: 'rounded-none',
      sm: 'rounded-lg',
      md: 'rounded-xl',
      lg: 'rounded-2xl',
      full: 'rounded-3xl',
    }

    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-8',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'transition-all duration-300',
          cardStyles[layout.cards],
          hover && hoverStyles[layout.cards],
          radiusStyles[layout.borderRadius],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ThemeCard.displayName = 'ThemeCard'

// ============================================
// THEME-AWARE BUTTON WRAPPER
// Applies button styling based on theme structure
// ============================================

export interface ThemeButtonClassesResult {
  rounded: string
  variant: string
}

export function useThemeButtonClasses(): ThemeButtonClassesResult {
  const { layout } = useThemeLayout()

  const roundedStyles = {
    rounded: 'rounded-lg',
    pill: 'rounded-full',
    square: 'rounded-none',
    minimal: 'rounded-md',
  }

  return {
    rounded: roundedStyles[layout.buttons],
    variant: layout.buttons === 'minimal' ? 'ghost' : 'default',
  }
}

// ============================================
// SECTION WRAPPER
// Applies consistent section spacing based on theme
// ============================================

export interface ThemeSectionProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article'
}

export const ThemeSection = forwardRef<HTMLElement, ThemeSectionProps>(
  ({ className, as: Component = 'section', children, ...props }, ref) => {
    const { layout } = useThemeLayout()

    const spacingStyles = {
      compact: 'py-12 lg:py-16',
      normal: 'py-16 lg:py-24',
      relaxed: 'py-20 lg:py-32',
    }

    return (
      <Component
        ref={ref as any}
        className={cn(spacingStyles[layout.sectionSpacing], className)}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

ThemeSection.displayName = 'ThemeSection'

// ============================================
// GRADIENT BACKGROUND (conditional based on theme)
// ============================================

export interface ThemeGradientProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'subtle'
}

export function ThemeGradient({ className, variant = 'subtle', children, ...props }: ThemeGradientProps) {
  const { layout } = useThemeLayout()

  if (!layout.gradients) {
    return <div className={className} {...props}>{children}</div>
  }

  const gradientStyles = {
    primary: 'bg-gradient-to-b from-primary/10 via-primary/5 to-transparent',
    secondary: 'bg-gradient-to-br from-rose/10 via-gold/5 to-transparent',
    subtle: 'bg-gradient-to-b from-primary/5 via-transparent to-transparent',
  }

  return (
    <div className={cn(gradientStyles[variant], className)} {...props}>
      {children}
    </div>
  )
}

// ============================================
// GLASS EFFECT WRAPPER (conditional based on theme)
// ============================================

export interface ThemeGlassProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: 'light' | 'medium' | 'strong'
}

export function ThemeGlass({ className, intensity = 'medium', children, ...props }: ThemeGlassProps) {
  const { layout } = useThemeLayout()

  if (!layout.glassmorphism) {
    return (
      <div className={cn('bg-card border border-border', className)} {...props}>
        {children}
      </div>
    )
  }

  const glassStyles = {
    light: 'glass-light backdrop-blur-sm bg-card/60',
    medium: 'glass backdrop-blur-md bg-card/70',
    strong: 'glass-strong backdrop-blur-xl bg-card/80',
  }

  return (
    <div className={cn(glassStyles[intensity], 'border border-white/10', className)} {...props}>
      {children}
    </div>
  )
}
