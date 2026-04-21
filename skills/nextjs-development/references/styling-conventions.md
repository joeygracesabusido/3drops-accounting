# Styling Conventions

Next.js projects should follow these styling patterns.

## Tailwind CSS
- Use utility-first styling with Tailwind CSS.
- Keep components small and focused.
- Leverage the `clsx` and `tailwind-merge` (often as `cn` in `lib/utils.ts`) utilities for dynamic class names.

## shadcn/ui
- Use shadcn/ui for accessible, pre-styled UI components.
- Components are located in `components/ui/`.
- Customize components directly in `components/ui/` if needed.

## Icons
- Use **lucide-react** for all icons.
- Ensure consistent icon sizing (`className="w-4 h-4"`) in components.

## Forms and Inputs
- Use the `Label` and `Input` components from shadcn/ui for consistency.
- Implement error states visually using the `destructive` badge or alert colors.
