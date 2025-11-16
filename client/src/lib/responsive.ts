/**
 * Global Responsive Utilities
 * 2 Breakpoint System: Mobile (<1024px) and Desktop (≥1024px)
 */

export const BREAKPOINTS = {
  mobile: 1024, // Mobile: <1024px
  desktop: 1024, // Desktop: ≥1024px
} as const;

// Responsive utility hooks
export const useResponsive = () => {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < BREAKPOINTS.mobile : true;
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS.desktop : false;

  return {
    isMobile,
    isDesktop,
    isTablet: false, // No tablet breakpoint in our system
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
  };
};

// Responsive class generators
export const getResponsiveClass = (
  mobileClass: string,
  desktopClass?: string
) => {
  return `${mobileClass} ${desktopClass ? `lg:${desktopClass}` : ''}`.trim();
};

// Common responsive patterns
export const responsiveClasses = {
  // Layout
  sidebar: getResponsiveClass('sidebar-mobile', 'sidebar-desktop'),
  sidebarXL: getResponsiveClass('sidebar-mobile', 'sidebar-desktop-xl'),

  // Typography
  textXs: getResponsiveClass('text-mobile-xs'),
  textSm: getResponsiveClass('text-mobile-sm'),
  textBase: getResponsiveClass('text-mobile-base'),
  textLg: getResponsiveClass('text-mobile-lg'),

  // Spacing
  paddingSm: getResponsiveClass('p-mobile-sm'),
  paddingMd: getResponsiveClass('p-mobile-md'),
  paddingLg: getResponsiveClass('p-mobile-lg'),

  // Display
  mobileOnly: 'mobile-only',
  desktopOnly: 'desktop-only',

  // Components
  card: getResponsiveClass('card-mobile', 'card-desktop'),
  buttonSm: getResponsiveClass('btn-mobile-sm'),
  buttonMd: getResponsiveClass('btn-mobile-md'),

  // Icons
  iconXs: getResponsiveClass('icon-mobile-xs'),
  iconSm: getResponsiveClass('icon-mobile-sm'),
  iconMd: getResponsiveClass('icon-mobile-md'),

  // Container
  container: getResponsiveClass('container-responsive'),

  // Visibility
  sidebarMobileOnly: 'sidebar-mobile-only',
  sidebarDesktopOnly: 'sidebar-desktop-only',
} as const;

// Responsive value helpers
export const getResponsiveValue = <T>(
  mobileValue: T,
  desktopValue?: T
): T => {
  // In a real app, you'd check window width here
  // For now, return mobile value as default
  return mobileValue;
};

// Common responsive configurations
export const responsiveConfig = {
  sidebar: {
    width: {
      mobile: 256, // 16rem = 256px
      desktop: 320, // 20rem = 320px
      xl: 384,     // 24rem = 384px
      '2xl': 448,  // 28rem = 448px
    },
  },

  header: {
    height: {
      mobile: 64,    // 4rem = 64px
      desktop: 80,   // 5rem = 80px
    },
  },

  spacing: {
    sm: { mobile: 8, desktop: 16 },    // 0.5rem / 1rem
    md: { mobile: 12, desktop: 24 },   // 0.75rem / 1.5rem
    lg: { mobile: 16, desktop: 32 },   // 1rem / 2rem
    xl: { mobile: 24, desktop: 48 },   // 1.5rem / 3rem
  },

  fontSize: {
    xs: { mobile: 12, desktop: 14 },   // 0.75rem / 0.875rem
    sm: { mobile: 14, desktop: 16 },   // 0.875rem / 1rem
    base: { mobile: 16, desktop: 18 }, // 1rem / 1.125rem
    lg: { mobile: 18, desktop: 20 },   // 1.125rem / 1.25rem
    xl: { mobile: 20, desktop: 24 },   // 1.25rem / 1.5rem
  },

  iconSize: {
    xs: { mobile: 14, desktop: 16 },   // 0.875rem / 1rem
    sm: { mobile: 16, desktop: 20 },   // 1rem / 1.25rem
    md: { mobile: 20, desktop: 24 },   // 1.25rem / 1.5rem
    lg: { mobile: 24, desktop: 28 },   // 1.5rem / 1.75rem
  },
} as const;

// Helper functions for common patterns
export const getSidebarClass = (variant: 'default' | 'xl' = 'default') => {
  const widths = responsiveConfig.sidebar.width;
  const mobileWidth = widths.mobile;
  const desktopWidth = variant === 'xl' ? widths['2xl'] : widths.desktop;

  return `w-[${mobileWidth}px] lg:w-[${desktopWidth}px]`;
};

export const getTextColorClass = (size: 'xs' | 'sm' | 'base' | 'lg') => {
  const sizes = responsiveConfig.fontSize[size];
  return `text-[${sizes.mobile}px] lg:text-[${sizes.desktop}px]`;
};

export const getSpacingClass = (size: 'sm' | 'md' | 'lg' | 'xl', type: 'p' | 'm' | 'gap' = 'p') => {
  const sizes = responsiveConfig.spacing[size];
  return `${type}-[${sizes.mobile}px] lg:${type}-[${sizes.desktop}px]`;
};

// Device detection utilities
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < BREAKPOINTS.mobile;
};

export const isDesktopDevice = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= BREAKPOINTS.desktop;
};

// Media query helper
export const mediaQuery = {
  mobile: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
} as const;

// CSS custom properties for responsive values
export const cssVariables = {
  '--sidebar-width-mobile': `${responsiveConfig.sidebar.width.mobile}px`,
  '--sidebar-width-desktop': `${responsiveConfig.sidebar.width.desktop}px`,
  '--header-height-mobile': `${responsiveConfig.header.height.mobile}px`,
  '--header-height-desktop': `${responsiveConfig.header.height.desktop}px`,
} as const;