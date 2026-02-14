# Performance Optimization Guide

## Code Splitting and Lazy Loading

Project Sparkle implements several performance optimization strategies:

### 1. Route-Based Code Splitting

All page components are lazy-loaded using React's `lazy()` and `Suspense`:

```typescript
const Residents = lazy(() => import('@/pages/Residents'));
const Antibiotics = lazy(() => import('@/pages/Antibiotics'));
```

**Benefits:**
- Reduced initial bundle size
- Faster initial page load
- Components loaded only when needed

### 2. Vendor Chunk Splitting

The Vite configuration splits vendor libraries into separate chunks:

```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'ui-vendor': ['@radix-ui/...'],
  'form-vendor': ['react-hook-form', 'zod'],
}
```

**Benefits:**
- Better caching (vendor code changes less frequently)
- Parallel download of multiple chunks
- Smaller individual chunk sizes

### 3. Component Preloading

Use the `usePreloadOnHover` hook to preload components before navigation:

```typescript
import { usePreloadOnHover } from '@/hooks/useLazyComponent';

const ResidentsPage = lazy(() => import('@/pages/Residents'));

function Navigation() {
  const preloadProps = usePreloadOnHover(ResidentsPage);
  
  return (
    <Link to="/residents" {...preloadProps}>
      Residents
    </Link>
  );
}
```

### 4. Loading States

Always provide meaningful loading states:

```typescript
<Suspense fallback={<LoadingSpinner />}>
  <LazyComponent />
</Suspense>
```

## Bundle Size Analysis

### Analyze Current Bundle

```bash
npm run build
npx vite-bundle-visualizer
```

### Target Metrics

- Initial bundle: < 200KB (gzipped)
- Largest chunk: < 150KB (gzipped)
- Time to Interactive: < 3s on 3G

## Performance Monitoring

### Track Core Web Vitals

```typescript
import { reportWebVitals } from '@/lib/monitoring';

// In main.tsx
reportWebVitals();
```

### Monitor Component Render Times

```typescript
import { measureRenderTime } from '@/lib/monitoring';

function MyComponent() {
  const stopMeasure = measureRenderTime('MyComponent');
  
  useEffect(() => {
    return stopMeasure;
  }, []);
}
```

## Best Practices

### Do's

✅ Lazy load routes and heavy components
✅ Split vendor bundles appropriately
✅ Use React.memo() for expensive components
✅ Implement virtualization for long lists
✅ Optimize images (use WebP, proper sizing)
✅ Minimize third-party dependencies

### Don'ts

❌ Don't lazy load components used immediately
❌ Don't create too many small chunks
❌ Don't forget loading states
❌ Don't ignore bundle size warnings
❌ Don't load large libraries for small features

## Implementation Checklist

- [ ] Replace `App.tsx` with `App.optimized.tsx`
- [ ] Replace `vite.config.ts` with `vite.config.optimized.ts`
- [ ] Add `LoadingSpinner` component to your components
- [ ] Wrap async routes with Suspense boundaries
- [ ] Test loading states with network throttling
- [ ] Analyze bundle size with build tools
- [ ] Monitor performance with analytics

## Resources

- [React Code Splitting](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vitejs.dev/guide/build.html#chunking-strategy)
- [Web Vitals](https://web.dev/vitals/)
- [Bundle Analysis](https://github.com/btd/rollup-plugin-visualizer)
