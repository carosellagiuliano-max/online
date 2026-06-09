/**
 * Theme Styles Component
 *
 * Server component that injects CSS variables based on the selected theme.
 * Theme is configured via NEXT_PUBLIC_THEME in .env / .env.dev
 *
 * Available themes: beauty, ocean, forest, midnight, dark, brownie
 */

import { getTheme, type ThemeColors } from '@/lib/config/themes'

function generateCSSVariables(colors: ThemeColors): string {
  return `
    --gold: ${colors.gold};
    --gold-light: ${colors.goldLight};
    --gold-dark: ${colors.goldDark};
    --rose: ${colors.rose};
    --rose-light: ${colors.roseLight};
    --rose-dark: ${colors.roseDark};
    --cream: ${colors.cream};
    --charcoal: ${colors.charcoal};

    --background: ${colors.background};
    --foreground: ${colors.foreground};
    --card: ${colors.card};
    --card-foreground: ${colors.cardForeground};
    --popover: ${colors.popover};
    --popover-foreground: ${colors.popoverForeground};
    --primary: ${colors.primary};
    --primary-foreground: ${colors.primaryForeground};
    --secondary: ${colors.secondary};
    --secondary-foreground: ${colors.secondaryForeground};
    --muted: ${colors.muted};
    --muted-foreground: ${colors.mutedForeground};
    --accent: ${colors.accent};
    --accent-foreground: ${colors.accentForeground};
    --destructive: ${colors.destructive};
    --border: ${colors.border};
    --input: ${colors.input};
    --ring: ${colors.ring};

    --chart-1: ${colors.chart1};
    --chart-2: ${colors.chart2};
    --chart-3: ${colors.chart3};
    --chart-4: ${colors.chart4};
    --chart-5: ${colors.chart5};

    --sidebar: ${colors.sidebar};
    --sidebar-foreground: ${colors.sidebarForeground};
    --sidebar-primary: ${colors.sidebarPrimary};
    --sidebar-primary-foreground: ${colors.sidebarPrimaryForeground};
    --sidebar-accent: ${colors.sidebarAccent};
    --sidebar-accent-foreground: ${colors.sidebarAccentForeground};
    --sidebar-border: ${colors.sidebarBorder};
    --sidebar-ring: ${colors.sidebarRing};
  `
}

export function ThemeStyles() {
  const theme = getTheme()

  const cssContent = `
    :root {
      ${generateCSSVariables(theme.light)}
    }

    .dark {
      ${generateCSSVariables(theme.dark)}
    }
  `

  return (
    <style
      id="theme-variables"
      dangerouslySetInnerHTML={{ __html: cssContent }}
    />
  )
}
