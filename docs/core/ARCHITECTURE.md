# ELAYON ARCHITECTURE

## Core Modules

- Authentication Layer
- Calibration Engine
- CRS Engine
- FIFO Memory
- Audio Pipeline
- Metrics Extraction
- AI Orchestration
- Report Engine

---

## Main Flow

User
→ Audio Capture
→ Metrics Extraction
→ CRS Processing
→ Context Delta
→ AI Interpretation
→ Response
→ Report

---

## Layer Separation

Frontend:
- visualization
- interaction
- local controls

Core:
- CRS
- FIFO
- contextual interpretation

API:
- providers
- orchestration
- auth
- contracts

Persistence:
- calibration references
- reports
- tokens
- session state

---

## Critical Rules

- audio remains local by default
- CRS never directly manipulates UI
- FIFO preserves chronology
- reports are generated post-analysis
- calibration is mandatory
