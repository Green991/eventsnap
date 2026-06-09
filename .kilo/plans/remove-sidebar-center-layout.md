# Plan: Remove sidebar, center dashboard layout

## Problem
Dashboard has a fixed left sidebar (256px) that is not wanted. The \md:pl-64\ on <main> shifts content right, and the sidebar takes up space unnecessarily.

## Changes

### 1. Remove sidebar (lines 130-156 of dashboard.html)
Delete the entire sidebar <nav> block. Move \createNewEventBtn\ and \logoutBtn\ to the top bar.

### 2. Replace the two separate headers (desktop + mobile) with one unified top bar
Single responsive header with:
- Logo + event selector (left side)
- Nuevo Evento button + user email + logout icon (right side)
- Visible on all screen sizes (flex instead of hidden md:flex)

### 3. Keep eventSelectorMobile for JS sync
A hidden element after the header for dashboard.js mobile sync code.

### 4. Fix <main> layout
- Remove \md:pl-64\ (no sidebar offset)
- Reduce top padding (\pt-14 md:pt-16\ for single header)
- Reduce \max-w-[1600px]\ to \max-w-[900px]\ for better centering

### 5. Keep mobile bottom nav unchanged

## Files to modify
- dashboard.html — remove sidebar, merge headers, fix main layout
- No changes to dashboard.js needed (all IDs preserved)

## Verification
1. Sidebar gone, no empty space on left
2. Top bar full-width, content centered
3. logoutBtn, createNewEventBtn, eventSelector, userEmail all work
4. Mobile logout and create button still work via JS
5. Bento grid content centered on screen
