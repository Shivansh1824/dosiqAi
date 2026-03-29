# dosiq Ai Mobile Design Standards

This document outlines the standard UI patterns and spacing units to ensure consistency across all screens in the dosiq Ai mobile application.

## 1. Layout & Spacing

To maintain a clean, high-density look across screens, follow these standard padding and gap values.

| Property | Value | Constant | Description |
| :--- | :--- | :--- | :--- |
| **H-Padding** | 16px | `Sizes.md` | Standard horizontal padding for screen content (ScrollView). |
| **V-Gap (Section)** | 16px | `Sizes.md` | Standard vertical gap between major sections or cards. |
| **V-Gap (Dense)** | 12px | `12` | Used for tighter grouping of related cards (e.g., Medications list). |
| **Internal Padding** | 16px | `Sizes.md` | Standard internal padding for cards and containers. |

## 2. Card Styles

Cards are the primary container for information. They should follow a consistent visual language.

- **Background:** `Colors.white`
- **Border Radius:** `16px` (`Sizes.radiusLg`)
- **Border:** `1px` width with `Colors.border` (subtle light grey).
- **Shadow:** Use `boxShadow: '0 1px 4px rgba(0,0,0,0.06)'` for a subtle, premium lift.
- **Border Curve:** Use `borderCurve: 'continuous'` for smooth iOS-style rounded corners.

## 3. Typography

- **Font Family:** `PlusJakartaSans`
- **Scale:**
    - **Header:** `16px` Bold (`PlusJakartaSans-Bold`)
    - **Subtitle:** `12px` Medium (`PlusJakartaSans-Medium`)
    - **Body:** `14px` Regular/Medium
    - **Tiny/Status:** `10px-11px` Bold/Medium

## 4. Hierarchy & Colors

- **Screen Background:** `Colors.bgSecondary` (very light grey/blue) to provide contrast for white cards.
- **Primary Actions:** `Colors.primary` (Blue).
- **Success/Warning/Error:** Use standard semantic colors from `Colors.ts`.
- **Text:**
    - Primary: `Colors.textPrimary` (Near black/dark grey).
    - Secondary: `Colors.textSecondary` (Medium grey).
    - Tertiary: `Colors.textTertiary` (Light grey for hints/sub-labels).

---

*Note: Always use constants from `src/constants` instead of hardcoded values where possible.*
