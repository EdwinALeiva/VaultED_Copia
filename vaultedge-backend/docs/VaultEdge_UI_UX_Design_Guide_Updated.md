
# VaultEdge – UI/UX Design & Navigation Guide

This document provides a complete UI/UX design and navigation guide for the VaultEdge application, 
following modern SaaS best practices and design guidelines inspired by Material Design 3, 
Apple Human Interface Guidelines, and Fuselab Creative’s SaaS design principles. 
It is optimized to serve as a direct prompt or reference for any AI-assisted development process.

---

## 1. Brand & Visual Identity
- **Theme**: Professional, secure, modern.
- **Primary Color**: Blue (#2563EB) → Trust, security, stability.
- **Secondary Colors**:
  - Gray (#6B7280) → Neutral backgrounds & inactive states.
  - Green (#10B981) → Success messages & positive actions.
  - Red (#EF4444) → Error & destructive actions.
- **Typography**:
  - Headings: Inter Bold or SF Pro Display.
  - Body: Inter / Roboto regular.
  - Minimum body size: 16px.
- **Iconography**: Simple outline icons (Lucide or Material Icons) with consistent stroke width.

---

## 2. Layout & Structure
- **Navigation Model**:
  - Top Right Hamburger Menu: Global actions.
  - Left Vertical Context Menu: Contextual per screen.
  - Fixed Header: Branding + search.
- **Grid & Spacing**: 8px grid, 24px between main sections.
- **Responsive**:
  - Mobile: Bottom tab navigation, hamburger for secondary.
  - Tablet: Collapsible left menu.
  - Desktop: Full side menu with icons + labels.

---

## 3. Interaction Principles
- **Few Clicks Rule**: No core action beyond 3 clicks.
- **Progressive Disclosure**: Show basics first, advanced later.
- **Feedback on Every Action**: Progress bars, confirmations, snackbars.
- **Keyboard Shortcuts**: Ctrl+U (upload), Ctrl+N (new SafeBox).
- **Drag & Drop**: For uploads and reordering.

---

## 4. Core Screens & Navigation
Core Screens:
1. Login & MFA.
2. Dashboard.
3. SafeBox Detail.
4. File Preview.
5. Audit Logs.
6. Settings.
7. Billing & Plans.
8. Support/Help.
9. Confirmation Modals.

---

## 5. Visual Style & Components
- **Cards**: Rounded corners (16px), soft shadows.
- **Buttons**: Primary Blue, Secondary Outline, Destructive Red.
- **Forms**: Floating labels, inline validation.
- **Tables**: Alternating row colors, sticky header.

---

## 6. Accessibility & Usability
- WCAG AA contrast.
- Full keyboard navigation.
- ARIA labels.
- Clear error handling.
- Plain language.

---

## 7. Security-First UX Considerations
- Show last accessed date.
- MFA status visible.
- Warn for key expiry.
- Show file hash.

---

## 8. Modern SaaS Trends
- Minimalist UI.
- Dark Mode.
- Microinteractions.
- Persistent Search.
- Context Menus.
- Illustrated Empty States.

---

## 9. Prompt Instruction for AI Designers
```
Design a modern SaaS web application called VaultEdge, a secure digital vault for storing contracts 
and source code under dual-key encryption. Follow Material Design 3, Apple HIG, and SaaS UX best 
practices from fuselabcreative.com. The UI must be clean, trust-inspiring, and responsive, with minimal 
clicks to core actions, accessible to all users, and visually attractive. Apply a blue (#2563EB) primary 
theme, clear typography, contextual left menu, global top-right hamburger menu, fixed header, responsive 
cards, and interactive feedback. Include all core screens, confirmation modals, and consistent visual 
language across the platform.
```

---

## 10. Navigation Flow
- Login / MFA → Dashboard → SafeBox Detail → File Preview
- From SafeBox Detail → Audit Logs / Version History
- Hamburger Menu → Settings / Billing
- Left Menu → Support
- All screens return to Dashboard via logo or back arrow.

---

## 11. Navigation & Interaction Detailed Specs

### 11.1 Dark Mode Implementation
- **Switch Location**: User profile dropdown (top-right) and Settings > Preferences.
- **Color Palette**:
  - Primary Blue: #2563EB (adjusted for contrast if needed).
  - Dark Background: #1E1E1E.
  - Light Background: #F9FAFB.
  - Text Dark Mode: #F3F4F6.
  - Text Light Mode: #1F2937.
- **Persistence**: Save choice in user profile (DB) and local storage.
- **Transition**: Smooth fade (200–300ms) when toggling.

### 11.2 Icons
- **Library**: Lucide Icons or Material Symbols (outline variant).
- **Style**: Outline, 2px stroke, no drop shadows, consistent padding.
- **Recommended Icons**:
  - SafeBox: 🗄
  - File: 📄
  - Upload: ⬆
  - Download: ⬇
  - Settings: ⚙
  - Billing: 💳
  - Audit Logs: 📜
  - Logout: ⎋

### 11.3 Left-Side Menu Behavior
- **Behavior**: Dynamic, changing based on the current context.
- **Dashboard Context**:
  - All SafeBoxes
  - Recent Activity
  - Support
- **SafeBox Detail Context**:
  - Share
  - Audit Logs
  - Version History
- **File Preview Context**:
  - Download
  - Compare Versions
  - View Metadata
- **Collapsed Mode**: Show only icons, with tooltips on hover.

### 11.4 Hamburger Menu (Top Right)
- **Always present**, contains global actions:
  - Create SafeBox
  - Upload File
  - Search (if not already in header)
  - Settings
  - Billing & Subscription
  - Logout

### 11.5 Back Button Placement & Behavior
- **Location**: Top-left corner, consistent with Apple HIG and Material guidelines.
- **Behavior**:
  - From SafeBox Detail → back to Dashboard.
  - From File Preview → back to SafeBox Detail.
- **Mobile**: Support both native OS back gestures and in-app back button.

---
