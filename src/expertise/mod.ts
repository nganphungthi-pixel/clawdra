/**
 * Expertise Patterns - Framework-specific knowledge
 * Next.js, React, Tailwind, WordPress, UI/UX, and more
 */

export interface ExpertisePattern {
  name: string;
  category: string;
  triggers: string[];
  guidelines: string;
  bestPractices: string[];
  commonPitfalls: string[];
  codeExamples: string[];
}

export const EXPERTISE_PATTERNS: ExpertisePattern[] = [
  // ============================================
  // NEXT.JS
  // ============================================
  {
    name: "nextjs",
    category: "framework",
    triggers: ["next.js", "nextjs", "next.config", "getServerSideProps", "getStaticProps", "app router", "pages router"],
    guidelines: `Next.js Expert Mode Active.

Key concepts:
- App Router (Next.js 13+) uses React Server Components by default
- "use client" directive for client components
- Server Actions for mutations
- File-based routing in app/ directory
- Metadata API for SEO
- Image optimization with next/image
- Font optimization with next/font`,
    bestPractices: [
      "Use App Router over Pages Router for new projects",
      "Keep server components as default, add 'use client' only when needed",
      "Use Server Actions instead of API routes for mutations",
      "Implement proper error boundaries",
      "Use Streaming SSR with Suspense boundaries",
      "Optimize images with next/image",
      "Use next/font for automatic font optimization",
    ],
    commonPitfalls: [
      "Using useState/useEffect in server components",
      "Not handling loading states with Suspense",
      "Fetching data in client components instead of server",
      "Missing revalidation config for cached data",
      "Using document/window in server components",
    ],
    codeExamples: [
      `// Server Component with data fetching
export default async function Page() {
  const data = await fetch('https://api.example.com', { next: { revalidate: 3600 } });
  return <div>{data.title}</div>;
}`,
      `// Client Component with interactivity
'use client';
import { useState } from 'react';
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}`,
    ],
  },

  // ============================================
  // REACT
  // ============================================
  {
    name: "react",
    category: "framework",
    triggers: ["react", "jsx", "tsx", "component", "useState", "useEffect", "hooks"],
    guidelines: `React Expert Mode Active.

Key concepts:
- Functional components with hooks
- React 18+ concurrent features
- Server Components vs Client Components
- State management patterns
- Performance optimization`,
    bestPractices: [
      "Use functional components, not class components",
      "Keep components small and focused",
      "Use useMemo/useCallback only when needed (measure first)",
      "Lift state up only when necessary",
      "Use React.memo for expensive re-renders",
      "Prefer composition over inheritance",
      "Use custom hooks for reusable logic",
    ],
    commonPitfalls: [
      "Infinite loops with useEffect dependencies",
      "Stale closures in useEffect",
      "Unnecessary re-renders from inline objects/arrays",
      "Mutating state directly",
      "Missing cleanup in useEffect",
    ],
    codeExamples: [
      `// Custom hook pattern
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}`,
    ],
  },

  // ============================================
  // TAILWIND CSS
  // ============================================
  {
    name: "tailwind",
    category: "styling",
    triggers: ["tailwind", "className", "clsx", "cva", "variant"],
    guidelines: `Tailwind CSS Expert Mode Active.

Key concepts:
- Utility-first CSS
- Responsive design with breakpoints
- Dark mode support
- Custom config extensions
- Component variants with CVA`,
    bestPractices: [
      "Use clsx or classnames for conditional classes",
      "Use cva (class-variance-authority) for component variants",
      "Keep tailwind.config.js DRY with plugins",
      "Use @apply sparingly, prefer utility classes",
      "Use group-hover and peer-* for state-based styling",
    ],
    commonPitfalls: [
      "Conflicting utility classes (last one wins)",
      "Not configuring content paths properly",
      "Using !important overrides instead of specificity",
      "Missing dark: variants",
    ],
    codeExamples: [
      `import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';

const button = cva('rounded font-medium transition', {
  variants: {
    intent: { primary: 'bg-blue-500 text-white', secondary: 'bg-gray-200' },
    size: { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2' },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});

<Button className={button({ intent: 'primary', size: 'md' })}>Click</Button>;`,
    ],
  },

  // ============================================
  // SHADCN/UI
  // ============================================
  {
    name: "shadcn",
    category: "ui",
    triggers: ["shadcn", "radix", "ui component", "dialog", "popover", "dropdown"],
    guidelines: `shadcn/ui Expert Mode Active.

Key concepts:
- Headless UI with Radix primitives
- Tailwind-based styling
- Copy-paste components (not a library)
- Customizable via class variants
- Accessible by default`,
    bestPractices: [
      "Components live in your codebase, not node_modules",
      "Customize via tailwind.config.js theme",
      "Use cn() utility for merging classes",
      "Extend components with Radix props",
    ],
    commonPitfalls: [
      "Trying to import from npm (it's copy-paste)",
      "Not merging classes properly causing conflicts",
      "Forgetting to install radix-ui dependencies",
    ],
    codeExamples: [],
  },

  // ============================================
  // WORDPRESS
  // ============================================
  {
    name: "wordpress",
    category: "cms",
    triggers: ["wordpress", "wp-", "wp-cli", "plugin", "theme", "woocommerce"],
    guidelines: `WordPress Expert Mode Active.

Key concepts:
- REST API for headless WordPress
- Custom post types and taxonomies
- Gutenberg blocks development
- Theme development hierarchy
- Plugin security best practices
- WooCommerce hooks and templates`,
    bestPractices: [
      "Use wp_enqueue_script/style, not inline scripts",
      "Sanitize input, escape output",
      "Use nonces for form submissions",
      "Follow WordPress Coding Standards",
      "Use child themes for customization",
    ],
    commonPitfalls: [
      "Direct database queries instead of WP_Query",
      "Missing security sanitization",
      "Hardcoding paths or URLs",
      "Not checking function existence",
    ],
    codeExamples: [],
  },

  // ============================================
  // UI/UX DESIGN
  // ============================================
  {
    name: "ui-ux",
    category: "design",
    triggers: ["ui", "ux", "design", "responsive", "accessibility", "a11y", "user experience"],
    guidelines: `UI/UX Design Expert Mode Active.

Key principles:
- Mobile-first responsive design
- WCAG 2.1 AA accessibility
- Consistent design system
- Clear visual hierarchy
- Intuitive navigation
- Fast perceived performance`,
    bestPractices: [
      "Use semantic HTML for accessibility",
      "Maintain 4.5:1 contrast ratio minimum",
      "Support keyboard navigation",
      "Use ARIA labels where needed",
      "Implement loading skeletons",
      "Use motion respectfully (prefers-reduced-motion)",
      "Design for touch (44px minimum)",
    ],
    commonPitfalls: [
      "Color-only state indicators",
      "Missing focus indicators",
      "Auto-playing media with sound",
      "Inconsistent spacing",
      "Poor error messages",
    ],
    codeExamples: [],
  },

  // ============================================
  // SUPABASE
  // ============================================
  {
    name: "supabase",
    category: "backend",
    triggers: ["supabase", "postgres", "row level security", "rls", "edge function"],
    guidelines: `Supabase Expert Mode Active.

Key concepts:
- PostgreSQL with Row Level Security
- Real-time subscriptions
- Edge Functions (Deno)
- Storage with signed URLs
- Auth with providers`,
    bestPractices: [
      "Always enable RLS on tables",
      "Use database functions for complex logic",
      "Index foreign keys and frequently queried columns",
      "Use service_role key only server-side",
      "Implement proper error handling",
    ],
    commonPitfalls: [
      "Exposing service_role key to client",
      "Missing RLS policies",
      "N+1 queries without RPC functions",
      "Not handling real-time disconnects",
    ],
    codeExamples: [],
  },

  // ============================================
  // FIREBASE
  // ============================================
  {
    name: "firebase",
    category: "backend",
    triggers: ["firebase", "firestore", "realtime database", "firebase auth", "cloud functions"],
    guidelines: `Firebase Expert Mode Active.

Key concepts:
- Firestore document/collection model
- Security rules for access control
- Cloud Functions for backend logic
- Authentication providers
- Hosting and CDN`,
    bestPractices: [
      "Denormalize data for read performance",
      "Use security rules, not just client logic",
      "Implement pagination with cursors",
      "Batch writes when possible",
      "Use Firebase Emulator for development",
    ],
    commonPitfalls: [
      "Deep nesting in Firestore documents",
      "Missing security rules",
      "Unbounded queries without limits",
      "Cold starts in Cloud Functions",
    ],
    codeExamples: [],
  },

  // ============================================
  // VERCEL
  // ============================================
  {
    name: "vercel",
    category: "deploy",
    triggers: ["vercel", "edge function", "middleware", "deployment", "preview"],
    guidelines: `Vercel Expert Mode Active.

Key concepts:
- Edge Functions for low-latency logic
- Middleware for request modification
- Preview deployments
- Environment variables
- Analytics and monitoring`,
    bestPractices: [
      "Use Edge Functions for geolocation/personalization",
      "Implement proper caching headers",
      "Use preview deployments for testing",
      "Monitor with Vercel Analytics",
    ],
    commonPitfalls: [
      "Edge function size limits (4MB)",
      "Missing environment variables in deployment",
      "Not handling edge cases in middleware",
    ],
    codeExamples: [],
  },

  // ============================================
  // RESEND (Email)
  // ============================================
  {
    name: "resend",
    category: "email",
    triggers: ["resend", "email", "transactional", "mjml", "react email"],
    guidelines: `Resend Email Expert Mode Active.

Key concepts:
- React Email for component-based emails
- MJML for responsive templates
- Transactional vs marketing emails
- Email deliverability
- Template management`,
    bestPractices: [
      "Use React Email components",
      "Test emails with preview mode",
      "Implement proper error handling",
      "Use webhooks for delivery tracking",
    ],
    commonPitfalls: [
      "Using CSS not supported by email clients",
      "Missing plain text fallback",
      "Not testing across email clients",
    ],
    codeExamples: [],
  },

  // ============================================
  // GITHUB / DEVOPS
  // ============================================
  {
    name: "github-devops",
    category: "devops",
    triggers: ["github actions", "ci/cd", "pull request", "workflow", "actions"],
    guidelines: `GitHub/DevOps Expert Mode Active.

Key concepts:
- GitHub Actions workflows
- CI/CD pipelines
- Pull request automation
- Release management
- Secret management`,
    bestPractices: [
      "Pin action versions with SHA",
      "Use matrix builds for multi-env testing",
      "Cache dependencies for faster builds",
      "Use environment protection rules",
    ],
    commonPitfalls: [
      "Hardcoded secrets in workflows",
      "Not pinning action versions",
      "Missing timeout-minutes",
      "Overly permissive permissions",
    ],
    codeExamples: [],
  },
];

/**
 * Match expertise patterns to a query
 */
export function matchExpertise(query: string): ExpertisePattern[] {
  const lowerQuery = query.toLowerCase();
  return EXPERTISE_PATTERNS.filter(pattern =>
    pattern.triggers.some(trigger => lowerQuery.includes(trigger.toLowerCase()))
  );
}

/**
 * Get expertise context for system prompt
 */
export function getExpertiseContext(query: string): string {
  const matched = matchExpertise(query);
  if (matched.length === 0) return "";

  return matched.map(p => `## ${p.name.toUpperCase()} EXPERTISE ACTIVE\n${p.guidelines}`).join("\n\n");
}
