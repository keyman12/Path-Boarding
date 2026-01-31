/**
 * Path brand design tokens (section 8 of plan).
 * Use these in components for consistency with Path Brand Guidelines.
 */

export const pathColors = {
  primary: "#297D2D",
  primaryLight1: "#3B9F40",
  primaryLight2: "#49BC4E",
  secondary: "#FF5252",
  secondaryLight1: "#FF8A80",
  secondaryLight2: "#FFA49C",
  grey900: "#1a1a1a",
  grey700: "#4a4a4a",
  grey500: "#737373",
  grey300: "#a3a3a3",
  grey100: "#f5f5f5",
  white: "#ffffff",
} as const;

export const pathTypography = {
  h0: { fontSize: 72, lineHeight: 1.1 },
  h1: { fontSize: 48, lineHeight: 1.2 },
  h2: { fontSize: 32, lineHeight: 1.25 },
  h3: { fontSize: 24, lineHeight: 1.3 },
  h4: { fontSize: 18, lineHeight: 1.4 },
  p1: { fontSize: 16, lineHeight: 1.5 },
  p2: { fontSize: 14, lineHeight: 1.5 },
} as const;

export const pathFonts = {
  primary: "var(--font-poppins), sans-serif",
  secondary: "var(--font-roboto), sans-serif",
} as const;
