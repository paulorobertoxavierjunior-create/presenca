# MODULE STRUCTURE

/docs/modules/

Purpose:
Modularize CRS operational domains while preserving
core protocol isolation.

---

# 1. MEMORY MODULE

/docs/modules/memory/

Responsibilities:
- persistent storage contracts
- semantic retrieval
- vector association
- historical compression
- contextual reconstruction

Files:
- MEMORY_ENGINE.md
- MEMORY_PIPELINE.md
- RETRIEVAL_RULES.md
- COMPRESSION_POLICY.md

---

# 2. SESSION MODULE

/docs/modules/session/

Responsibilities:
- active session state
- temporary calibration
- FIFO continuity
- logout invalidation
- runtime context tracking

Files:
- SESSION_ENGINE.md
- SESSION_STATE.md
- CONTEXT_WINDOW.md
- RECALIBRATION.md

---

# 3. ROUTING MODULE

/docs/modules/routing/

Responsibilities:
- request classification
- orchestration flow
- model delegation
- execution priority
- fallback sequencing

Files:
- ROUTER.md
- ORCHESTRATION.md
- PRIORITY_RULES.md
- FALLBACKS.md

---

# 4. CONTEXT MODULE

/docs/modules/context/

Responsibilities:
- semantic interpretation
- contextual linking
- entity continuity
- latent signal propagation
- ambiguity resolution

Files:
- CONTEXT_ENGINE.md
- ENTITY_MAPPING.md
- SEMANTIC_LINKING.md
- SIGNAL_PROPAGATION.md

---

# 5. SCORING MODULE

/docs/modules/scoring/

Responsibilities:
- confidence estimation
- response ranking
- calibration metrics
- semantic consistency scoring
- validation heuristics

Files:
- SCORING_ENGINE.md
- CONFIDENCE.md
- VALIDATION.md
- METRICS.md

---

# 6. ORCHESTRATION MODULE

/docs/modules/orchestration/

Responsibilities:
- multi-module coordination
- execution lifecycle
- pipeline synchronization
- state transitions
- operational recovery

Files:
- ORCHESTRATOR.md
- EXECUTION_FLOW.md
- STATE_MACHINE.md
- RECOVERY.md

---

# MODULE CONTRACTS

All modules must:
- preserve CRS compatibility
- preserve semantic contracts
- preserve metric consistency
- expose deterministic interfaces
- update documentation on modification

---

# ISOLATION RULES

Modules:
- must remain independently replaceable
- must avoid hidden dependencies
- must communicate through declared contracts
- must preserve contextual continuity

---

# VERSIONING

Each module maintains:
- semantic version
- compatibility matrix
- migration notes
- calibration history