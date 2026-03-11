# FakeNewsOff Jury Demonstration Checklist

**Demo Date:** TBD  
**Demo Duration:** 90 seconds  
**Production URL:** https://d1bfsru3sckwq1.cloudfront.net

---

## Pre-Demo Checklist (15 minutes before)

### Technical Verification
- [ ] Open production URL: https://d1bfsru3sckwq1.cloudfront.net
- [ ] Verify page loads successfully
- [ ] Check API status indicator shows "Healthy" (green)
- [ ] Enable Demo Mode toggle
- [ ] Test one example claim to verify demo mode works
- [ ] Verify response time is <5 seconds
- [ ] Check that orchestration metadata displays
- [ ] Verify ClaimEvidenceGraph renders correctly
- [ ] Test export functionality (copy to clipboard)
- [ ] Clear browser cache if needed

### Environment Setup
- [ ] Close unnecessary browser tabs
- [ ] Disable browser notifications
- [ ] Set browser zoom to 100%
- [ ] Open production URL in main window
- [ ] Have backup screenshots ready (if needed)
- [ ] Have demo script open in separate window
- [ ] Start timer/stopwatch for 90-second timing

### Backup Plan
- [ ] Screenshots of expected results prepared
- [ ] Demo script printed or on separate device
- [ ] Alternative browser ready (if primary fails)
- [ ] Mobile device with app loaded (if desktop fails)

---

## 90-Second Demo Script

### Segment 1: Introduction (5 seconds)
**Action:** Show landing page  
**Say:** "FakeNewsOff helps users verify claims using AI-powered evidence orchestration."

**Visual Checkpoints:**
- [ ] Clear value proposition visible
- [ ] Example claims displayed
- [ ] API status shows healthy
- [ ] Demo mode toggle visible

---

### Segment 2: Claim Input (5 seconds)
**Action:** Click example claim or type claim  
**Say:** "Let's analyze a claim about [topic]."

**Visual Checkpoints:**
- [ ] Input field accepts text
- [ ] Submit button is clickable
- [ ] Demo mode is enabled

**Example Claims to Use:**
1. "COVID-19 vaccines are effective" (shows orchestration success)
2. "Climate change is caused by human activity" (shows multiple sources)
3. "The 2020 election was stolen" (shows contradiction detection)

---

### Segment 3: Analysis in Progress (10 seconds)
**Action:** Submit claim and show loading state  
**Say:** "The system uses iterative orchestration to retrieve and refine evidence across multiple passes."

**Visual Checkpoints:**
- [ ] Loading spinner appears immediately
- [ ] Progress indicators show stages
- [ ] Response completes in <5 seconds (demo mode)

---

### Segment 4: Results Overview (20 seconds)
**Action:** Show verdict and confidence  
**Say:** "The verdict is [verdict] with [X]% confidence. The orchestration pipeline executed [N] passes."

**Visual Checkpoints:**
- [ ] Verdict badge displays with color and icon
- [ ] Confidence score shows with progress bar
- [ ] Orchestration metadata section visible
- [ ] Passes executed displayed
- [ ] Source classes shown
- [ ] Average quality displayed

**Key Points to Highlight:**
- Multi-pass orchestration (2+ passes)
- Source diversity (multiple classes)
- Quality assessment (average quality score)
- Contradiction detection (if applicable)

---

### Segment 5: Evidence Graph (20 seconds)
**Action:** Scroll to ClaimEvidenceGraph  
**Say:** "The evidence graph visualizes relationships between the claim and sources, grouped by stance."

**Visual Checkpoints:**
- [ ] Graph renders with deterministic layout
- [ ] Claim node in center
- [ ] Supporting sources on right (green)
- [ ] Contradicting sources on left (red)
- [ ] Source nodes are clickable
- [ ] Hover tooltips work

**Key Points to Highlight:**
- Stance-based positioning (supports/contradicts)
- Credibility tier badges (tier 1/2/3)
- Interactive nodes (clickable, hoverable)
- Deterministic layout (no jitter)

---

### Segment 6: Source Details (15 seconds)
**Action:** Scroll to source list  
**Say:** "Sources are grouped by stance and ranked by credibility tier."

**Visual Checkpoints:**
- [ ] Sources grouped by stance
- [ ] Credibility tier badges visible
- [ ] Supporting sources listed first
- [ ] Contradicting sources prominent (if any)
- [ ] Source metadata displayed (domain, date)

**Key Points to Highlight:**
- Stance grouping (supports/contradicts/mentions)
- Credibility assessment (tier 1 = high, tier 2 = medium, tier 3 = low)
- Source diversity (multiple domains)

---

### Segment 7: SIFT Guidance (10 seconds)
**Action:** Scroll to SIFT panel  
**Say:** "The SIFT framework provides actionable guidance for users."

**Visual Checkpoints:**
- [ ] SIFT panel displays all 4 steps
- [ ] Stop, Investigate, Find, Trace sections visible
- [ ] Evidence URLs clickable
- [ ] Clear explanations provided

---

### Segment 8: Export & Wrap-up (5 seconds)
**Action:** Click "Copy to Clipboard" button  
**Say:** "Users can export results for sharing or further analysis."

**Visual Checkpoints:**
- [ ] Copy button works
- [ ] "Copied!" feedback appears
- [ ] Export JSON button visible

**Closing Statement:**
"FakeNewsOff combines iterative orchestration, credibility assessment, and explainable AI to help users make informed decisions about information they encounter online."

---

## Post-Demo Checklist

### Immediate Actions
- [ ] Note any technical issues encountered
- [ ] Record jury questions and feedback
- [ ] Document any feature requests
- [ ] Check CloudWatch logs for errors

### Follow-up Actions
- [ ] Send production URL to interested parties
- [ ] Provide access to documentation
- [ ] Share demo recording (if recorded)
- [ ] Schedule follow-up meetings if needed

---

## Troubleshooting Guide

### Issue: Page doesn't load
**Solution:**
1. Check internet connection
2. Try alternative browser
3. Use mobile device as backup
4. Show screenshots of expected results

### Issue: API status shows unhealthy
**Solution:**
1. Refresh page and check again
2. Proceed with demo mode (should still work)
3. Explain that demo mode uses cached responses
4. Show backend architecture diagram

### Issue: Demo mode response is slow
**Solution:**
1. Wait up to 10 seconds (should be <5s)
2. If timeout, refresh and try again
3. Use alternative example claim
4. Show screenshots as backup

### Issue: Graph doesn't render
**Solution:**
1. Scroll down to force lazy loading
2. Refresh page if needed
3. Show source list instead (same information)
4. Explain graph shows claim-evidence relationships

### Issue: Export doesn't work
**Solution:**
1. Try Export JSON instead of Copy
2. Explain functionality verbally
3. Show that data is available in results
4. Demonstrate on different browser

---

## Key Talking Points

### Technical Innovation
1. **Iterative Orchestration** - Multi-pass retrieval refines evidence quality
2. **Source Classification** - Automatic categorization by type and credibility
3. **Contradiction Detection** - Safety-first approach highlights conflicting evidence
4. **Quality Assessment** - Quantitative scoring of evidence quality

### User Experience
1. **Explainability** - Transparent orchestration metadata shows how analysis was performed
2. **Visual Evidence** - Interactive graph makes relationships clear
3. **Actionable Guidance** - SIFT framework provides next steps
4. **Accessibility** - WCAG AA compliant with keyboard navigation

### Production Readiness
1. **Performance** - Demo mode <5s, production mode <45s
2. **Scalability** - Serverless architecture handles variable load
3. **Reliability** - Retry logic and error handling
4. **Observability** - Structured logging and health monitoring

---

## Success Criteria

### Must Demonstrate
- ✅ Claim analysis completes successfully
- ✅ Orchestration metadata displays
- ✅ Evidence graph renders
- ✅ Sources grouped by stance
- ✅ Credibility tiers visible
- ✅ Export functionality works

### Nice to Demonstrate
- ✅ Contradiction detection (if applicable)
- ✅ Multiple source classes
- ✅ High quality evidence (>0.7)
- ✅ Interactive graph features
- ✅ SIFT guidance

### Timing Goals
- ✅ Complete demo in 90 seconds
- ✅ Allow 30 seconds for Q&A
- ✅ Total presentation: 2 minutes

---

## Contact Information

**Production URL:** https://d1bfsru3sckwq1.cloudfront.net  
**API Endpoint:** https://fnd9pknygc.execute-api.us-east-1.amazonaws.com  
**Documentation:** See JURY_READINESS_REPORT.md and backend/docs/demo-script.md

---

**Prepared By:** Kiro AI Assistant  
**Date:** March 10, 2026  
**Status:** Ready for demonstration
