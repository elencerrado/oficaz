# OficazIA AI System - Executive Summary

## System Overview

OficazIA is a **dual-path agentic AI system** combining:
- **Fast Path**: 7 deterministic pre-parsers (regex-based) → <500ms responses for common requests
- **Smart Path**: Iterative LLM loop with model routing → <2s for complex requests

**Architecture**: 
```
Client Request
  ↓
[Auth + Feature Check + Token Limit]
  ↓
[7 Pre-parser Patterns] ← Fast, deterministic
  ├─ Hours queries, Pending approvals, Active workers, Schedule creation/copy, etc.
  ├─ Returns immediately if matched (bypasses LLM)
  └─ Falls through to AI if pattern not matched
  ↓
[AI Main Loop] ← Intelligent, 4 iterations max
  ├─ Model Router: gpt-4o-mini (default) or gpt-4o (escalated)
  ├─ Tool calling: 30+ functions for HR/Scheduling/CRM/Accounting
  ├─ Employee name resolution
  ├─ Function execution
  └─ Iterates if AI needs more context
  ↓
[Response] Message + Navigation URL + Token tracking
```

---

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Default Model** | gpt-4o-mini | 20x cheaper than gpt-4o |
| **Max Iterations** | 4 | Safety limit, prevents infinite loops |
| **History Truncation** | Last 6 msgs | Optimization: 5min → 10sec latency |
| **Pre-parser Coverage** | 7 patterns | Handles ~80% of common queries |
| **Available Functions** | 30+ | Read-only + mutation functions |
| **Escalation Threshold** | Mutations | Auto-retry with stronger model |
| **Token Budget** | 1M/month (addon) | Monthly reset enforcement |

---

## Strengths ✅

1. **Cost-Optimized Routing**: Starts with cheap model, escalates only when needed
2. **Fast Path for Common Queries**: Pre-parsers bypass LLM latency entirely (<500ms)
3. **Iterative Problem Solving**: Handles multi-step workflows naturally
4. **Graceful Degradation**: Pre-parser failures fall through to AI loop
5. **Comprehensive Function Library**: Covers HR, CRM, Accounting, Scheduling
6. **Token Budgeting**: Monthly quotas prevent runaway costs
7. **Permission-Aware**: Routes.ts enforces admin/manager role checks

---

## Critical Issues 🚨

### 1. **Bulk Approval Without Confirmation** (CRITICAL)
- **Problem**: "Aprueba todas las vacaciones" auto-approves all pending requests
- **Risk**: 50+ requests approved with one sentence; no confirmation dialog
- **Impact**: Audit trail nightmare, labor disputes
- **Fix**: Add `needsConfirmation: true` flag, require explicit confirmation

### 2. **Conversation History Truncation** (CRITICAL)
- **Problem**: Keeps only last 6 messages, loses context in long conversations
- **Risk**: "Approve those too" after 50 messages → AI doesn't know what "those" are
- **Impact**: Multi-turn workflows break
- **Fix**: Smart pruning (keep summary + recent context)

### 3. **Escalation Doubles Costs** (HIGH)
- **Problem**: Escalation from gpt-4o-mini to gpt-4o = 20x cost multiplier
- **Risk**: Mutations trigger expensive retry; token budget burns fast
- **Impact**: ~$0.01-0.02 per escalated query
- **Fix**: Gradual escalation tiers (gpt-4o-mini → gpt-4o-turbo → gpt-4o)

### 4. **Triple Employee Name Resolution** (HIGH)
- **Problem**: Name resolved in routes.ts, ai-tool-runner.ts, AND inside functions
- **Risk**: Inconsistent behavior, wasted calls
- **Fix**: Centralize to ONE resolution layer

### 5. **No Feature Flagging** (HIGH)
- **Problem**: All 30 functions always available, regardless of subscription tier
- **Risk**: Free tier users can call premium functions
- **Fix**: Add feature check before function dispatch

---

## Implementation Details

### Model Router (Heuristics)

```
Decision Tree:
  1. Check keywords: "crear", "modificar", "rotación" → gpt-4o (expensive)
  2. Check message length: > 300 chars → gpt-4o
  3. Check temporal density: ≥ 2 dates/times → gpt-4o
  4. Default: gpt-4o-mini (cheap & fast)

After execution:
  5. Check escalation: mutation function called OR "no puedo" detected → retry with gpt-4o
```

### Pre-Parser Patterns (Routes.ts: 7 Patterns)

| Pattern | Example | Function | Fast? |
|---------|---------|----------|-------|
| Hours query | "cuántas horas trabajó?" | `getEmployeeWorkHours()` | ✅ |
| Active workers | "quién está fichado ahora?" | `getActiveWorkers()` | ✅ |
| Pending approvals | "qué hay pendiente?" | `getPendingApprovals()` | ✅ |
| **Approve all** ⚠️ | "aprueba todas las vacaciones" | `approveVacationRequests()` | ✅ |
| Schedule creation | "ramirez trabaja de 8 a 14 la semana que viene" | `assignScheduleInRange()` | ✅ |
| Schedule copy | "X tiene los mismos turnos que Y" | `copyEmployeeShifts()` | ✅ |
| Schedule after | "X trabaja después de Y" | `createShiftAfterEmployee()` | ✅ |

### AI Main Loop (Max 4 Iterations)

```
Iteration 1:
  - getPreferredModel() → choose gpt-4o-mini or gpt-4o-turbo
  - openai.chat.completions() → AI decides what functions to call
  - Run functions (e.g., listEmployees, getVacationBalance)
  - Add results to conversation history

Iteration 2:
  - AI reviews results, decides to call more functions (e.g., approveVacationRequests)
  - Run functions
  - Add to history

Iteration 3-4:
  - Continue if more functions needed
  - Exit when AI says "done" (no tool_calls in response)
```

### Token Tracking

```
Before request: Check if month changed
  - If yes: Reset aiTokensUsed to 0, set aiTokensResetDate
  - If no: Load current usage

During request:
  - Track each LLM call: totalTokensUsed += response.usage.total_tokens
  - Track escalations: 20x cost if gpt-4o used

After request:
  - Save: await storage.updateCompanySubscription({
      aiTokensUsed: currentUsed + totalTokensUsed
    })
  - Enforce: if(currentUsed >= tokenLimit) return 429 "Rate limited"
```

---

## Performance Characteristics

| Operation | Time | Bottleneck |
|-----------|------|-----------|
| Pre-parser hit (hours) | 200-500ms | DB query + formatting |
| Simple 1-turn function | 800-1500ms | LLM latency (300-1500ms) |
| Multi-step (3+ functions) | 3000-8000ms | Multiple LLM calls |
| Escalated query | 5000-12000ms | **2x LLM calls** (mini + max) |

---

## Database Query Patterns

### Good ✅
- `listEmployees()` → Single `getUsersByCompany()` query
- `getCompanySettings()` → Single `getCompany()` query

### Bad ❌
- `getVacationBalance()` → **N+1 pattern**:
  ```
  1. Load all vacation requests (1 query)
  2. For each employee:
     3. calculateVacationDays() (N queries)
     4. filter requests (O(N) in-memory)
  Total: 1 + N queries for N employees
  ```

- `assignScheduleInRange()` → No query batching for bulk operations

---

## Token Budget Enforcement

```
Plan: OficazIA addon active?
  → tokenLimit = 1M tokens/month
  
Monthly cycle: Tracked by aiTokensResetDate
  → January 1st: Reset counter
  → January 31st: Still counting
  → February 1st: Auto-reset to 0
  
Usage tracking:
  Opening → Opening + ✅ escalated = 20x
  Query → $0.0003 (cheap) → $0.006 (escalated)
```

---

## Cost Examples

| Scenario | Tokens | Cost (Cheap) | Cost (Escalated) | Escalation Rate |
|----------|--------|--------------|------------------|-----------------|
| Simple query | 200 | $0.00003 | $0.0006 | 20x |
| Complex query | 1000 | $0.00015 | $0.003 | 20x |
| Bulk approval | 500 | $0.000075 | $0.0015 | 20x |
| Multi-turn (3 iter) | 3000 | $0.00045 | $0.009 | 20x |

**20+ escalations/month** = ~$0.10-0.15 extra (adds up on $0 token budget).

---

## Top 5 Recommendations (Priority Order)

### 1. Add Confirmation for Bulk Operations (Week 1)
**Effort**: 2-3 hours | **Impact**: Prevents accidental mass approvals
```
Before: "aprueba todas" → immediate execution
After: "aprueba todas" → "¿Seguro de aprobar 42 solicitudes?" → confirmation required
```

### 2. Centralize Employee Name Resolution (Week 1)
**Effort**: 4-5 hours | **Impact**: 30% faster execution
- Resolve all names once in routes.ts middleware
- Pass employeeIds through entire pipeline
- Remove duplicate resolution in functions

### 3. Smart Conversation History Pruning (Week 2)
**Effort**: 3-4 hours | **Impact**: Preserve context in long conversations
- Keep first system context + summaries of old conversations
- Recent messages in full
- Estimate token count to avoid LLM token limit

### 4. Reduce Escalation Costs (Week 2)
**Effort**: 2-3 hours | **Impact**: 30% cost reduction
- Tier 1 escalation: gpt-4o-mini → gpt-4o-turbo (5x cost)
- Tier 2 escalation: gpt-4o-turbo → gpt-4o (4x cost)
- Only use gpt-4o for mutations/high-risk actions

### 5. Feature Flagging in Dispatcher (Week 2)
**Effort**: 2-3 hours | **Impact**: Security + Subscription compliance
```
Before: All 30 functions always callable
After: Check subscription.features before dispatch
  - createCRMContact requires 'crm' feature
  - createWorkReport requires 'work_reports' feature
  - etc.
```

---

## Quick Audit Checklist

- [ ] How are bulk operations confirmed? **ISSUE**: No confirmation dialog exists
- [ ] Can users exhaust company token budget alone? **ISSUE**: No per-user limits
- [ ] Are all functions rate-limited? **ISSUE**: Only company-level limit
- [ ] What happens if name resolution fails? **ISSUE**: Silent skip, AI doesn't know
- [ ] Are AI actions audited? **ISSUE**: No audit trail implemented
- [ ] Can free users call premium functions? **ISSUE**: No feature flagging
- [ ] How long can multi-turn conversations last? **ISSUE**: Context lost after 6 messages
- [ ] What's the cost of a failed escalation? **ISSUE**: 20x cost multiplier always applied

---

## Next Steps

1. **Read Full Analysis**: See `OFICAZIA_SYSTEM_ARCHITECTURE_DEEP_DIVE.md`
2. **Prioritize Fixes**: Use "Top 5 Recommendations" as starting point
3. **Create Issues**: One GitHub issue per recommendation
4. **Track Progress**: Weekly status updates
5. **Monitor Impact**: Token usage, latency, error rates post-fixes

---

**Full analysis document**: [OFICAZIA_SYSTEM_ARCHITECTURE_DEEP_DIVE.md](./OFICAZIA_SYSTEM_ARCHITECTURE_DEEP_DIVE.md)
