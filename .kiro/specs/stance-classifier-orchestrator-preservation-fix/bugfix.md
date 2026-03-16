# Bugfix Requirements Document

## Introduction

The stance classifier correctly identifies trusted sources (Reuters, BBC, AP, etc.) as "supports" when they contain explicit confirmation patterns. However, the evidenceOrchestrator overrides these stance values by hardcoding them to 'mentions' at three locations (stages 1, 2, and 3). This causes all sources to appear as "mentions" in the final verdict, resulting in artificially low confidence scores even when trusted sources explicitly confirm the claim.

This bug affects the accuracy of the verification system by:
- Misrepresenting source stance in the final verdict
- Reducing confidence scores inappropriately
- Undermining the value of trusted source detection
- Breaking the evidence quality assessment pipeline

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the stanceClassifier correctly classifies a trusted source as "supports" THEN the evidenceOrchestrator overrides this value to 'mentions' during stage 1 processing

1.2 WHEN the stanceClassifier correctly classifies a trusted source as "supports" THEN the evidenceOrchestrator overrides this value to 'mentions' during stage 2 processing

1.3 WHEN the stanceClassifier correctly classifies a trusted source as "supports" THEN the evidenceOrchestrator overrides this value to 'mentions' during stage 3 processing

1.4 WHEN multiple trusted sources explicitly confirm a claim THEN the final verdict shows all sources as "mentions" instead of "supports"

1.5 WHEN the final verdict is synthesized with sources incorrectly marked as "mentions" THEN the confidence score is artificially low (below 0.5) despite strong supporting evidence

### Expected Behavior (Correct)

2.1 WHEN the stanceClassifier classifies a source with any stance value THEN the evidenceOrchestrator SHALL preserve that stance value during stage 1 processing

2.2 WHEN the stanceClassifier classifies a source with any stance value THEN the evidenceOrchestrator SHALL preserve that stance value during stage 2 processing

2.3 WHEN the stanceClassifier classifies a source with any stance value THEN the evidenceOrchestrator SHALL preserve that stance value during stage 3 processing

2.4 WHEN multiple trusted sources are classified as "supports" THEN the final verdict SHALL show these sources with stance "supports"

2.5 WHEN the final verdict is synthesized with sources correctly marked as "supports" THEN the confidence score SHALL reflect the strong supporting evidence (0.85-0.95 range)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the stanceClassifier classifies a source as "refutes" THEN the evidenceOrchestrator SHALL CONTINUE TO preserve this stance value

3.2 WHEN the stanceClassifier classifies a source as "mentions" THEN the evidenceOrchestrator SHALL CONTINUE TO preserve this stance value

3.3 WHEN the stanceClassifier classifies a source as "unrelated" THEN the evidenceOrchestrator SHALL CONTINUE TO preserve this stance value

3.4 WHEN sources are filtered by relevance or quality thresholds THEN the orchestrator SHALL CONTINUE TO apply these filters correctly

3.5 WHEN the orchestrator processes non-trusted sources THEN it SHALL CONTINUE TO handle them with the same logic as before

3.6 WHEN the orchestrator aggregates evidence across multiple stages THEN it SHALL CONTINUE TO merge results correctly

3.7 WHEN all 508 backend tests, 33 orchestrator tests, and 22 stance classifier tests are run THEN they SHALL CONTINUE TO pass
