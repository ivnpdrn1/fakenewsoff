# Iterative Evidence Orchestration - Validation Checklist

## Overview

This document provides a comprehensive validation checklist for the iterative evidence orchestration pipeline before production rollout.

## Feature Flag Configuration

- [ ] `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=false` - Legacy pipeline (default)
- [ ] `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true` - New orchestration pipeline

## 1. Feature Flag Behavior

### Legacy Pipeline (Flag Disabled)
- [ ] Text-only claims use legacy `groundTextOnly()` function
- [ ] Response format matches existing contract
- [ ] No `orchestration` metadata field in response
- [ ] Claim Evidence Graph renders correctly
- [ ] SIFT guidance displays properly
- [ ] Copy/export functionality works
- [ ] No regressions in existing behavior

### Orchestration Pipeline (Flag Enabled)
- [ ] Text-only claims route to `analyzeWithIterativeOrchestration()`
- [ ] Claims with URL still use legacy pipeline
- [ ] Response includes `orchestration` metadata
- [ ] Backward compatible fields present (`status_label`, `confidence_score`, `text_grounding`)
- [ ] Frontend renders without errors
- [ ] Claim Evidence Graph handles new response format
- [ ] SIFT guidance still functional

### Fallback Behavior
- [ ] Orchestration errors fall back to legacy pipeline gracefully
- [ ] Error logs captured for debugging
- [ ] User receives valid response even on orchestration failure
- [ ] No 500 errors exposed to frontend

## 2. Response Schema Compatibility

### Required Legacy Fields
- [ ] `status_label` - string (verdict classification)
- [ ] `confidence_score` - number (0-100)
- [ ] `rationale` - string (explanation)
- [ ] `text_grounding` - object with sources

### Text Grounding Structure
- [ ] `sources` - array of source objects
- [ ] `queries` - number or array
- [ ] `providerUsed` - array of strings
- [ ] `sourcesCount` - number
- [ ] `cacheHit` - boolean
- [ ] `latencyMs` - number

### Source Object Structure
- [ ] `url` - string
- [ ] `title` - string
- [ ] `snippet` - string
- [ ] `domain` - string
- [ ] `publishDate` - string (ISO8601)
- [ ] `score` - number (0-1)
- [ ] `stance` - string (supports/contradicts/mentions/unclear)
- [ ] `provider` - string
- [ ] `credibilityTier` - number (1-3)

### Optional Orchestration Metadata
- [ ] `orchestration.enabled` - boolean
- [ ] `orchestration.passes_executed` - number
- [ ] `orchestration.source_classes` - number
- [ ] `orchestration.average_quality` - number
- [ ] `orchestration.contradictions_found` - boolean

## 3. Evidence Quality Validation

### Generic Page Rejection
- [ ] Homepage links rejected (e.g., `example.com/`)
- [ ] Category pages rejected (e.g., `example.com/category/news`)
- [ ] Tag pages rejected (e.g., `example.com/tag/politics`)
- [ ] Search pages rejected (e.g., `example.com/search?q=...`)
- [ ] "Latest news" landing pages rejected

### Broken Link Detection
- [ ] 404 pages excluded from results
- [ ] Unavailable pages excluded
- [ ] Timeout pages excluded
- [ ] Only accessible pages included

### Source Quality
- [ ] No duplicate URLs in final evidence
- [ ] No duplicate titles (similarity check)
- [ ] Sources relevant to claim
- [ ] Sources from diverse domains
- [ ] Primary sources prioritized when available

### Contradiction Handling
- [ ] Contradictory evidence included in analysis
- [ ] Contradictions not filtered out simply for disagreeing
- [ ] Contradiction queries executed
- [ ] Contradictory sources marked with appropriate stance

## 4. Frontend Rendering Validation

### Claim Evidence Graph
- [ ] Graph renders with orchestration response
- [ ] Nodes display correctly
- [ ] Edges show relationships
- [ ] Stance colors correct (green=supports, red=contradicts, gray=mentions)
- [ ] Tooltips show source details
- [ ] No console errors

### Results Display
- [ ] Verdict classification displays
- [ ] Confidence score shows
- [ ] Rationale text renders
- [ ] Source cards display
- [ ] Source links clickable
- [ ] Domain badges show
- [ ] Publish dates formatted

### SIFT Guidance
- [ ] Stop step displays
- [ ] Investigate step displays
- [ ] Find step displays
- [ ] Trace step displays
- [ ] Evidence URLs linked correctly

### Copy/Export
- [ ] Copy to clipboard works
- [ ] Export functionality works
- [ ] Formatted output correct

## 5. Test Matrix - Representative Claims

### Clearly True Claims
- [ ] "Water freezes at 0 degrees Celsius"
- [ ] "The Earth orbits the Sun"
- [ ] "Paris is the capital of France"

**Expected**: `classification: "true"`, high confidence, supporting evidence

### Clearly False Claims
- [ ] "The Earth is flat"
- [ ] "Vaccines cause autism"
- [ ] "The moon landing was faked"

**Expected**: `classification: "false"`, high confidence, contradicting evidence

### Misleading / Overstated Claims
- [ ] "Crime is at an all-time high" (when statistics show decline)
- [ ] "Unemployment is the worst ever" (when not historically accurate)

**Expected**: `classification: "misleading"`, moderate confidence, mixed evidence

### Partially True Claims
- [ ] "The economy is growing" (true GDP growth, but wages stagnant)
- [ ] "Renewable energy is increasing" (true but still minority of total)

**Expected**: `classification: "partially_true"`, moderate confidence, supporting + contradicting

### Unverifiable / Rumor-like Claims
- [ ] "A celebrity said something controversial" (no primary source)
- [ ] "A secret meeting happened" (no official confirmation)

**Expected**: `classification: "unverified"`, low confidence, insufficient evidence

### Time-Sensitive Geopolitical Claims
- [ ] Recent military action announcements
- [ ] Recent diplomatic agreements
- [ ] Recent sanctions announcements

**Expected**: Primary sources prioritized, official statements included, recent dates

### Health-Related Claims
- [ ] Medical treatment effectiveness
- [ ] Disease outbreak information
- [ ] Public health guidance

**Expected**: Official health org sources, fact-checkers, medical journals

### Election/Political Claims
- [ ] Election results
- [ ] Policy announcements
- [ ] Political statements

**Expected**: Official sources, major news outlets, fact-checkers, diverse perspectives

## 6. Pipeline Metrics Validation

### Performance
- [ ] Total latency < 30 seconds for typical claim
- [ ] NOVA calls < 10 per analysis
- [ ] Grounding calls < 15 per analysis
- [ ] Memory usage reasonable

### Quality
- [ ] Average quality score > 0.6
- [ ] Source diversity >= 2 classes
- [ ] At least 3 sources in final evidence (when available)
- [ ] Passes executed: 1-3 (adaptive)

### Observability
- [ ] All pipeline stages logged
- [ ] Timestamps present in logs
- [ ] Error logs captured
- [ ] Metrics collected

## 7. Structured Logging Verification

### Required Log Stages
- [ ] `pipeline` - Start and complete
- [ ] `decomposition` - Start and complete
- [ ] `query_generation` - Start and complete
- [ ] `orchestration` - Start and complete
- [ ] `contradiction` - Start and complete
- [ ] `synthesis` - Start and complete

### Log Structure
- [ ] `stage` - string
- [ ] `timestamp` - ISO8601 string
- [ ] `message` - string
- [ ] `data` - optional object with metrics

### Error Logs
- [ ] Errors logged with stack traces
- [ ] Error stage identified
- [ ] Fallback actions logged

## 8. Integration Test Coverage

### Feature Flag Tests
- [x] Flag disabled uses legacy pipeline
- [x] Flag enabled uses orchestration for text-only
- [x] Claims with URL use legacy regardless of flag
- [x] Fallback to legacy on orchestration error

### Response Schema Tests
- [x] Backward compatible fields present
- [x] Orchestration metadata optional
- [x] Source array structure valid
- [x] Frontend expectations satisfied

### Error Handling Tests
- [x] Invalid request returns 400
- [x] Malformed JSON returns 400
- [x] Internal errors return 500 with safe message
- [x] CORS headers present in all responses

### Pipeline Tests
- [x] Full pipeline completes successfully
- [x] Decomposition produces subclaims
- [x] Query generation produces queries
- [x] Evidence collection works
- [x] Verdict synthesis produces valid verdict
- [x] Structured logs emitted

## 9. Comparison: Legacy vs Orchestration

For each test claim, compare:

| Metric | Legacy | Orchestration | Pass/Fail |
|--------|--------|---------------|-----------|
| Verdict Quality | | | |
| Source Quality | | | |
| Broken Links | | | |
| Generic Pages | | | |
| Source Diversity | | | |
| Contradiction Handling | | | |
| Confidence Appropriateness | | | |
| Frontend Stability | | | |

## 10. Rollout Readiness

### Pre-Rollout Checklist
- [ ] All validation tests pass
- [ ] No critical regressions found
- [ ] Performance acceptable
- [ ] Error handling robust
- [ ] Logging comprehensive
- [ ] Documentation complete

### Rollout Plan
1. **Phase 1**: Internal testing with flag enabled (1 week)
2. **Phase 2**: Beta users with flag enabled (1 week)
3. **Phase 3**: 10% of production traffic (1 week)
4. **Phase 4**: 50% of production traffic (1 week)
5. **Phase 5**: 100% of production traffic (enable by default)

### Rollback Plan
- [ ] Feature flag can be disabled instantly
- [ ] Legacy pipeline remains functional
- [ ] No data loss on rollback
- [ ] Monitoring alerts configured

### Success Criteria
- [ ] Verdict quality improved or equal
- [ ] Source quality improved (fewer broken/generic links)
- [ ] Source diversity increased
- [ ] Contradiction handling improved
- [ ] No increase in error rate
- [ ] No frontend rendering issues
- [ ] User satisfaction maintained or improved

## 11. Known Limitations

Document any known limitations or issues:

1. **NOVA Dependency**: Pipeline requires NOVA API availability
2. **Latency**: Orchestration adds latency vs legacy (acceptable tradeoff for quality)
3. **Cost**: More NOVA calls = higher cost (monitor usage)
4. **Text-Only**: Only works for text-only claims (URL-based claims use legacy)

## 12. Monitoring and Alerts

### Metrics to Monitor
- [ ] Orchestration success rate
- [ ] Orchestration latency (p50, p95, p99)
- [ ] NOVA call count per analysis
- [ ] Grounding call count per analysis
- [ ] Error rate by stage
- [ ] Fallback rate to legacy
- [ ] Source quality metrics
- [ ] User satisfaction scores

### Alerts to Configure
- [ ] Orchestration error rate > 5%
- [ ] Orchestration latency > 30s (p95)
- [ ] NOVA call count > 15 per analysis
- [ ] Fallback rate > 10%
- [ ] Source quality degradation

## Validation Sign-Off

- [ ] **Engineering Lead**: All tests pass, code reviewed
- [ ] **Product Manager**: Feature meets requirements
- [ ] **QA Lead**: Manual testing complete, no blockers
- [ ] **DevOps**: Monitoring and alerts configured
- [ ] **Security**: No security concerns identified

**Date**: _______________

**Approved By**: _______________

**Ready for Rollout**: [ ] Yes [ ] No

**Notes**:
