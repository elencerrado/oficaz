import { lazy, Suspense } from 'react';

// Lazy load heavy UI components to reduce main bundle
// Command palette (cmdk) is ~100KB and rarely used
const CommandDialog = lazy(() => import('@/components/ui/command').then(m => ({ default: m.CommandDialog })));
const Command = lazy(() => import('@/components/ui/command').then(m => ({ default: m.Command })));
const CommandInput = lazy(() => import('@/components/ui/command').then(m => ({ default: m.CommandInput })));
const CommandList = lazy(() => import('@/components/ui/command').then(m => ({ default: m.CommandList })));
const CommandEmpty = lazy(() => import('@/components/ui/command').then(m => ({ default: m.CommandEmpty })));
const CommandGroup = lazy(() => import('@/components/ui/command').then(m => ({ default: m.CommandGroup })));
const CommandItem = lazy(() => import('@/components/ui/command').then(m => ({ default: m.CommandItem })));

// Sheet components are heavy due to animations and Radix primitives
const Sheet = lazy(() => import('@/components/ui/sheet').then(m => ({ default: m.Sheet })));
const SheetTrigger = lazy(() => import('@/components/ui/sheet').then(m => ({ default: m.SheetTrigger })));
const SheetContent = lazy(() => import('@/components/ui/sheet').then(m => ({ default: m.SheetContent })));
const SheetHeader = lazy(() => import('@/components/ui/sheet').then(m => ({ default: m.SheetHeader })));
const SheetTitle = lazy(() => import('@/components/ui/sheet').then(m => ({ default: m.SheetTitle })));

// Complex form components
const Select = lazy(() => import('@/components/ui/select').then(m => ({ default: m.Select })));
const SelectContent = lazy(() => import('@/components/ui/select').then(m => ({ default: m.SelectContent })));
const SelectItem = lazy(() => import('@/components/ui/select').then(m => ({ default: m.SelectItem })));
const SelectTrigger = lazy(() => import('@/components/ui/select').then(m => ({ default: m.SelectTrigger })));
const SelectValue = lazy(() => import('@/components/ui/select').then(m => ({ default: m.SelectValue })));

// Loading fallbacks
const UILoading = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={{ minHeight: '2rem' }} />
);

// Wrapper components with loading states
export function LazyCommandDialog({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-96" />}>
      <CommandDialog {...props}>
        {children}
      </CommandDialog>
    </Suspense>
  );
}

export function LazyCommand({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-64" />}>
      <Command {...props}>
        {children}
      </Command>
    </Suspense>
  );
}

export function LazyCommandInput(props: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-10" />}>
      <CommandInput {...props} />
    </Suspense>
  );
}

export function LazyCommandList({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-48" />}>
      <CommandList {...props}>
        {children}
      </CommandList>
    </Suspense>
  );
}

export function LazySheet({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="fixed inset-0" />}>
      <Sheet {...props}>
        {children}
      </Sheet>
    </Suspense>
  );
}

export function LazySheetContent({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-80 h-full" />}>
      <SheetContent {...props}>
        {children}
      </SheetContent>
    </Suspense>
  );
}

export function LazySelect({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-10" />}>
      <Select {...props}>
        {children}
      </Select>
    </Suspense>
  );
}

export function LazySelectContent({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-32" />}>
      <SelectContent {...props}>
        {children}
      </SelectContent>
    </Suspense>
  );
}

export function LazySelectItem({ children, ...props }: any) {
  return (
    <Suspense fallback={<UILoading className="w-full h-8" />}>
      <SelectItem {...props}>
        {children}
      </SelectItem>
    </Suspense>
  );
}

// Export other components
export { CommandEmpty, CommandGroup, CommandItem, SheetTrigger, SheetHeader, SheetTitle, SelectTrigger, SelectValue };