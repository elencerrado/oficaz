# Admin Time Tracking - DOM Structure Analysis

## Overview
This document provides a detailed breakdown of the DOM structure in the `admin-time-tracking.tsx` file, specifically focusing on the sessions tab layout and rendering hierarchy.

---

## 1. Main Page Layout Structure

```
<div> (root container)
  <StatsCardGrid> (4 stat cards above tabs)
  <TabNavigation> (Tab selector: Sessions | Requests | Summary)
  
  {activeTab === 'sessions' && (
    <div className="space-y-4"> (Main sessions container)
      <!-- Filter Bar -->
      <!-- Sessions List/Grid -->
    </div>
  )}
</div>
```

---

## 2. Sessions Tab Main Container

**Container Node:**
```jsx
{activeTab === 'sessions' && (
  <div className="space-y-4">
```

**Key Classes:** `space-y-4` (spacing between sections)

---

## 3. Filter Bar Section

```jsx
<div className="flex items-center gap-2 w-full">
  
  <!-- Info Counter (Static) -->
  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg whitespace-nowrap">
    <span className="text-sm font-medium text-foreground">{totalCount}</span>
    <span className="text-sm text-muted-foreground">{getFilterTitle()}</span>
  </div>

  <div className="flex-1"></div> <!-- Spacer -->

  <!-- Desktop Filter/Export/View Mode Buttons (hidden sm:hidden) -->
  <div className="hidden sm:flex items-center gap-2">
    <!-- Filter Button -->
    <Button variant="outline" size="sm"></Button>
    
    <!-- Export Button -->
    <Button variant="outline" size="sm"></Button>
    
    <!-- View Mode Toggle (List/Grid) -->
    <div className="flex bg-muted rounded-lg p-0.5">
      <Button variant={activeViewMode === 'list' ? 'default' : 'ghost'}></Button>
      <Button variant={activeViewMode === 'grid' ? 'default' : 'ghost'}></Button>
    </div>
  </div>

  <!-- Mobile Buttons (sm:hidden) -->
  <div className="sm:hidden flex items-center gap-2">
    <!-- Compact mobile versions of same buttons -->
  </div>
</div>
```

---

## 4. Expandable Filters Section (Conditional)

```jsx
{showFilters && (
  <div className="py-4 bg-muted/50 rounded-lg px-4 mb-4">
    <div className="grid gap-4 items-end grid-cols-1 lg:grid-cols-3">
      
      <!-- Employee Filter (only if not self-access mode) -->
      {!isSelfAccessOnly && (
        <div className="flex flex-col space-y-2">
          <label>Empleado</label>
          <EmployeeScopeDropdown {...props} />
        </div>
      )}

      <!-- Date Range Filters -->
      <div className="flex flex-col space-y-2">
        <label>Período de tiempo</label>
        
        <!-- Desktop Layout: All in one row -->
        <div className="hidden lg:flex items-center gap-2 w-full">
          <Button>Hoy</Button>
          <DatePickerDay />
          <Popover><Button>Mes</Button></Popover>
          <DatePickerPeriod />
          <Button>Limpiar filtros</Button>
        </div>

        <!-- Mobile Layout: Two rows -->
        <div className="lg:hidden space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button>Hoy</Button>
            <DatePickerDay />
            <Select>Mes</Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DatePickerPeriod />
            <Button>Limpiar</Button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 5. Sessions List Container - Main Scrollable Section

### 5a. Desktop List View (hidden md:block)

```jsx
<div className="space-y-4">
  
  {/* Conditional: isLoading wrapper */}
  <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
    
    <!-- DESKTOP: hidden md:block -->
    <div className="hidden md:block space-y-3">
      {(() => {
        // Complex rendering logic here - generates result[] array
        
        // visibleEntries.forEach - processes daily entries with infinite scroll
        
        result.push(
          <div key={rowKey} className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            
            <!-- CARD HEADER - Grid layout with 6 columns -->
            <div 
              className="grid items-center px-4 py-3.5 min-h-[72px] select-none transition-colors gap-3"
              style={{ gridTemplateColumns: 'minmax(220px,280px) 90px minmax(120px,1fr) 60px 36px 20px' }}
            >
              
              <!-- Column 1: Avatar + Employee Name (flex, min-w-0 for truncation) -->
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar size="sm" {...props} />
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {dayData.userName}
                  </span>
                  {dayData.hasAutoCompleted && (
                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  )}
                </div>
              </div>

              <!-- Column 2: Weekday + Day (centered, fixed width) -->
              <div className="text-center flex items-center justify-center h-5">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  LUN 5
                </span>
              </div>

              <!-- Column 3: Daily Timeline Bar (flexible) -->
              <div className="w-full">
                {dayData.isVirtual ? (
                  <div className="text-center text-sm font-medium text-gray-500">
                    SIN FICHAJE
                  </div>
                ) : (
                  <DailyTimelineBar dayData={dayData} />
                )}
              </div>

              <!-- Column 4: Total Hours (fixed width, right-aligned) -->
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm text-right">
                {totalDayHours.toFixed(1)}h
              </div>

              <!-- Column 5: Action Button - History/Audit (fixed width) -->
              <div className="justify-self-end" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline">
                  <History className="w-4 h-4" />
                </Button>
              </div>

              <!-- Column 6: Expand Chevron (fixed width, right-aligned) -->
              {!dayData.isVirtual && (
                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
              )}
            </div>

            <!-- EXPANDED DETAILS SECTION (Conditional) -->
            {!dayData.isVirtual && isExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                <div className="space-y-3">
                  
                  {/* Multiple session cards for the day */}
                  {dayData.sessions.map((session, sessionIndex) => (
                    <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      
                      <div className="flex gap-4">
                        
                        <!-- Session number indicator (if multiple sessions) -->
                        {dayData.sessions.length > 1 && (
                          <div className="flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-3xl font-bold text-gray-300">{sessionIndex + 1}</span>
                            {session.status === 'incomplete' && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                Incompleta
                              </span>
                            )}
                          </div>
                        )}

                        <!-- Details Grid: 1-4 columns depending on screen size -->
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          
                          <!-- Entrada (Entry Time) -->
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Entrada</div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-medium">{format(clockInTime, 'HH:mm')}</span>
                            </div>
                            {hasClockInLocation && (
                              <a href={...} className="flex items-center gap-1 text-xs text-blue-600">
                                <MapPin className="w-3 h-3" />
                                <span>coordinates</span>
                              </a>
                            )}
                          </div>

                          <!-- Salida (Exit Time) -->
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Salida</div>
                            {clockOutTime ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-red-500" />
                                  <span className="text-sm font-medium">{format(clockOutTime, 'HH:mm')}</span>
                                </div>
                                {hasClockOutLocation && (
                                  <a href={...} className="flex items-center gap-1 text-xs text-blue-600">
                                    <MapPin className="w-3 h-3" />
                                  </a>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">En curso...</span>
                            )}
                          </div>

                          <!-- Descansos (Breaks) -->
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Descansos</div>
                            {session.breakPeriods?.length > 0 ? (
                              <div className="space-y-1">
                                {session.breakPeriods.map((bp, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <Coffee className="w-3 h-3 text-orange-500" />
                                    <span className="text-gray-700">HH:mm - HH:mm</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Sin descansos</span>
                            )}
                          </div>

                          <!-- Duración (Duration) -->
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Duración</div>
                            <div className="text-sm font-medium text-gray-900">
                              {netHours.toFixed(1)}h
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
        
        // After all sessions, add infinite scroll observer
        result.push(
          <div key="load-more-observer" className="py-4">
            <div ref={loadMoreDesktopRef} className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              {hasMoreToDisplay ? (
                <>
                  <ArrowDown className="w-4 h-4 animate-bounce" />
                  <span>Desplaza para ver más ({remaining} restantes)</span>
                  <Button onClick={loadMoreSessions}>Cargar más</Button>
                </>
              ) : (
                <span>Has visto todos los {totalCount} fichajes</span>
              )}
            </div>
          </div>
        );
        
        return result;
      })()}
      
      <!-- Empty state (if no sessions) -->
      {sessionsWithNotClockedIn.length === 0 && (
        isLoading ? <ListLoadingState /> : <ListEmptyState />
      )}
    </div>
  </div>
)}
```

### 5b. Mobile List View (md:hidden)

```jsx
{activeViewMode === 'list' && (
  <div className="md:hidden space-y-2">
    {(() => {
      // Separate virtual sessions at top
      const virtualSessions = [...];
      
      virtualSessions.forEach(virtual => {
        result.push(
          <div key={virtualMobileKey} className="opacity-40 bg-card dark:bg-gray-800 border border-gray-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <AlertTriangle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <UserAvatar size="sm" {...props} />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-gray-900 text-sm">
                    {virtualSession.userName}
                  </span>
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    SIN FICHAJE
                  </span>
                </div>
              </div>
              <div className="text-right">
                {/* Expected time and delay info */}
              </div>
            </div>
          </div>
        );
      });
      
      // Then add real sessions
      visibleEntries.forEach((dayData, index) => {
        result.push(
          <div 
            key={mobileRowKey} 
            className="bg-card dark:bg-gray-800 border border-gray-200 rounded-xl mb-2 shadow-sm cursor-pointer select-none"
            onClick={toggleMobileExpand}
          >
            <!-- Compact mobile header -->
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <UserAvatar size="sm" {...props} />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-gray-900 text-sm">
                    {dayData.userName}
                  </span>
                  <span className="text-xs font-medium text-gray-500">
                    {weekdayAndDay}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {totalDayHours.toFixed(1)}h
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isMobileExpanded && "rotate-180")} />
              </div>
            </div>

            <!-- Mobile expanded details (if expanded) -->
            {isMobileExpanded && (
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                <div className="space-y-3">
                  {dayData.sessions.map((sess, sessIndex) => (
                    <div key={sess.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {/* Session header with index if multiple */}
                      {dayData.sessions.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Sesión {sessIndex + 1}
                          </span>
                          {sess.status === 'incomplete' && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              Incompleta
                            </span>
                          )}
                        </div>
                      )}
                      
                      <!-- Entry/Exit grid (2 columns) -->
                      <div className="grid grid-cols-2 gap-3">
                        <!-- Entry column with clock icon -->
                        <!-- Exit column with clock icon -->
                      </div>
                      
                      <!-- Breaks section (if any) -->
                      {sess.breakPeriods?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {sess.breakPeriods.map((bp, bpIdx) => (
                            <div className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              <Coffee className="w-3 h-3" />
                              {format(new Date(bp.breakStart), 'HH:mm')} - ...
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      });
      
      // Add infinite scroll observer for mobile
      result.push(
        <div key="load-more-observer-mobile" className="py-4 text-center">
          <div ref={loadMoreMobileRef} className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            {/* Similar to desktop but mobile-optimized */}
          </div>
        </div>
      );
      
      return result;
    })()}
    
    <!-- Empty state -->
  </div>
)}
```

### 5c. Grid (Weekly) View

```jsx
{activeViewMode === 'grid' && (
  <div className="space-y-4">
    <!-- Weekly table wrapper -->
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto sm:overflow-hidden">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            
            <!-- Header: Week navigation -->
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-700 w-[150px] bg-gray-50">
              <div className="flex items-center justify-center gap-1">
                <button onClick={() => setGridViewDate(prev => subWeeks(prev, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-xs font-medium whitespace-nowrap px-2">
                  {format(startOfWeek(gridViewDate), 'd MMM')} - {format(endOfWeek(gridViewDate), 'd MMM')}
                </span>
                
                <button onClick={() => setGridViewDate(prev => addWeeks(prev, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </th>

            <!-- Header: Day columns (Monday-Sunday) -->
            {eachDayOfInterval({ ... }).map(day => (
              <th key={...} className="px-2 py-3 text-center text-sm font-semibold" style={{ minWidth: '85px', maxWidth: '85px' }}>
                <!-- Day name and date -->
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody>
          <!-- Grid rows for each employee in the week -->
          {/* Each cell shows session blocks or status indicators */}
        </tbody>
      </table>
    </div>

    <!-- Grid session details modal (if opened) -->
    {selectedGridSession && showGridSessionModal && (
      <Dialog>
        <!-- Session details modal content -->
      </Dialog>
    )}
  </div>
)}
```

---

## 6. Scroll Container References

### Main Scroll Container
- **Data Attribute:** `data-scroll-container="admin-main"`
- **Location:** Found via `document.querySelector('[data-scroll-container="admin-main"]')`
- **Purpose:** Tracks main scrolling for "back to top" button visibility
- **Observer Refs:**
  - `loadMoreDesktopRef` - Desktop infinite scroll observer
  - `loadMoreMobileRef` - Mobile infinite scroll observer

### Nested Overflow Containers
- **Desktop expanded session card:** `overflow-hidden` on main card
- **Expanded details section:** `border-t border-gray-200 dark:border-gray-700` (no explicit overflow)
- **Mobile expanded section:** `border-t border-gray-200` (standard scroll)
- **Grid view table:** `overflow-x-auto sm:overflow-hidden` (horizontal scroll on small screens, hidden on larger)

---

## 7. Key CSS Classes & Tailwind Patterns

### Responsive Design
- **Hidden breakpoints:** `hidden md:block` (desktop), `md:hidden` (mobile), `hidden sm:flex` (desktop buttons)
- **Grid layouts:** 
  - Desktop: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (session details)
  - Filters: `grid-cols-1 lg:grid-cols-3` (desktop) or `grid-cols-1` (mobile)

### Overlay & Z-Index
- **Back to top button:** Fixed position at `z-[999]`, using `createPortal()` to render in document.body
- **"Back to top" positioned:** `fixed left-1/2 z-[999] -translate-x-1/2 bottom-[safe-area-inset-bottom]`

### Shadow & Border Styles
- **Cards:** `shadow-sm border border-gray-200 dark:border-gray-700`
- **Expanded sections:** `bg-gray-50 dark:bg-gray-900/50`
- **Summary cards:** `bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200`

### Wave Loading Animation
- **Classes applied:** `row-wave-loading row-wave-${index % 15}`
- **Triggered:** When `showSessionsWaveLoading` is true on initial load
- **Duration:** Up to 1 second delay before marking as "shown"

---

## 8. Infinite Scroll Implementation

### Mechanism
1. **Desktop observer:** `loadMoreDesktopRef` (inside render loop)
2. **Mobile observer:** `loadMoreMobileRef` (inside render loop)
3. **Hook:** `useStandardInfiniteScroll()` - uses Intersection Observer API
4. **Root margin:** `'100px'` (triggers loading 100px before reaching bottom)

### Display Logic
```javascript
const visibleEntries = dailyEntries.slice(0, displayedCount);
// displayedCount increases by ITEMS_PER_LOAD when loadMoreSessions() called
// Max: displayedCount limited to actual sessions or continues fetching from server
```

### States
- `displayedCount` - How many entries currently shown (client-side)
- `allSessions` - All loaded sessions (includes server-fetched pages)
- `hasNextPage` - Whether more pages available on server
- `isFetchingNextPage` - Loading indicator for next fetch

---

## 9. Key Container Classes Summary

| Container | Classes | Purpose |
|-----------|---------|---------|
| **Main sessions div** | `space-y-4` | Vertical spacing throughout |
| **Filter bar** | `flex items-center gap-2 w-full` | Horizontal layout for filters |
| **Desktop list** | `hidden md:block space-y-3` | Desktop-only, card spacing |
| **Mobile list** | `md:hidden space-y-2` | Mobile-only, tighter spacing |
| **Card** | `bg-card rounded-2xl shadow-sm border` | Main session card styling |
| **Card header** | `grid items-center gap-3` | 6-column grid layout |
| **Expanded details** | `border-t bg-gray-50 p-4 space-y-3` | Expandable content area |
| **Session detail card** | `bg-white rounded-xl border p-4 flex gap-4` | Individual session info |
| **Detail grid** | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` | Responsive detail columns |
| **Infinite scroll ref** | `py-4` | Observer trigger zone |
| **Grid view table** | `overflow-x-auto sm:overflow-hidden` | Week view table |

---

## 10. View Mode Switching

```javascript
const [activeViewMode, setActiveViewMode] = useState<'list' | 'grid'>('list');
```

- **List mode (default):** Shows daily cards with expandable sessions
- **Grid mode (weekly):** Shows table with employees as rows, days as columns
- **Toggle buttons:** Located in filter bar, styled as button group

---

## 11. Infinite Scroll Flow Diagram

```
User scrolls down
    ↓
Intersection Observer detects loadMoreRef
    ↓
loadMoreSessions() called
    ↓
Check: Are there more local sessions to show?
    ├─ YES: displayedCount += ITEMS_PER_LOAD
    └─ NO: Check if hasNextPage on server?
           ├─ YES: fetchNextPage() + displayedCount += ITEMS_PER_LOAD
           └─ NO: Show "End of list" message
```

---

## 12. Responsive Breakpoints Used

- **Mobile:** < 768px (`md:hidden`)
- **Tablet:** ≥ 768px < 1024px (`md:block` and partial `lg:hidden`)
- **Desktop:** ≥ 1024px (`lg:flex`, `lg:grid-cols-3`, etc.)
- **Small screens:** < 640px (`sm:` prefix for 640px breakpoint)

---

## 13. Notable Container Properties

### No Explicit Overflow (Uses parent scroll)
- Daily session cards
- Expanded session details
- Mobile session headers

### Explicit Overflow Control
- **Grid view table:** `overflow-x-auto sm:overflow-hidden`
- **Dialog/Modal content:** `max-h-[80vh] overflow-y-auto` (only in dialogs, not main view)
- **Popover month select:** `max-h-60 overflow-y-auto` (filter dropdown)

### Main Scroll Container
- Defined by app shell (not directly in this component)
- Identified by: `[data-scroll-container="admin-main"]`
- Used for: Back-to-top button visibility calculation

---

## Analysis Summary

✅ **Desktop List View**: Uses `hidden md:block` with `display:grid` for card headers (6-column layout)
✅ **Mobile List View**: Uses `md:hidden` with flex-based compact layout
✅ **Grid View**: Table with `overflow-x-auto` for horizontal scroll on small screens
✅ **Infinite Scroll**: Two refs (`loadMoreDesktopRef`, `loadMoreMobileRef`) trigger on intersection
✅ **No nested overflow-y-auto**: Main content relies on parent scroll container
✅ **Responsive containers**: All major sections use Tailwind breakpoints (`md`, `lg`, `sm`)
