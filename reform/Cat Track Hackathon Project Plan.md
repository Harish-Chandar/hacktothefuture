# Cat Track Hackathon Project Plan

Build a persistent memory for construction equipment that connects operating incidents, environmental conditions, repairs, and human observations. Demonstrate that a new session can use a machine's previous experience and that a recorded outcome changes its future recommendations.

This is a proposed implementation based on the written Caterpillar challenge and the representative's explanation supplied in this conversation. The features below are our scope choices, not an official rubric. Plan for four people and approximately 16 hours of remaining build time. Scale the schedule to the actual submission deadline and reserve its final 25 percent for verification and presentation.

## Product and demo scope

Primary user: technician investigating a recurring temperature anomaly. Supporting users: operator and fleet manager, the three roles named in the written prompt.

Build one convincing lifecycle for one excavator and include a second asset to demonstrate that histories stay separate. Use a small fictional dataset clearly labeled simulated. No actual machine integration is required for this prototype. Do not present invented equipment limits, repairs, or manuals as Caterpillar guidance.

The central experience is an asset workspace with a timeline, a contextual question panel, clickable evidence, and a form to record an inspection or repair outcome. A small connected-memory view is a useful stretch feature.

Demo story:
1. Select Excavator EX-042 and review its earlier overheating incident during dusty work.
2. Show the linked inspection, cleaning or repair, and subsequent outcome.
3. Replay a new telemetry event and an operator report. Ingestion creates a new event memory.
4. Ask why the machine is running hot. The system retrieves the earlier incident and explains its relevance, differences, and uncertainty with source citations.
5. Switch among technician, operator, and fleet manager views. The underlying facts remain the same while priorities and wording change.
6. Record a new inspection finding and outcome. For example, inspection rules out the initially suspected issue and identifies a different contributor in this fictional scenario.
7. Open a fresh session and ask again. The system retrieves the new finding, identifies the older hypothesis as superseded, and explains how its answer changed.

Do not prewrite the answers as the only working implementation. A replay control may load simulated inputs, but ingestion, retrieval, evidence links, and outcome persistence should really run.

## Deliverables and acceptance criteria

| ID | Deliverable | Owner | Done when |
|---|---|---|---|
| D1 | Shared schema and API contract | B with all teammates | Everyone uses the same asset, event, source, relation, and answer fields; one sample request and response are committed |
| D2 | Simulated demo dataset | Ronak | Two assets, about 12â€“20 connected events, CSV telemetry, operator notes, service notes, environmental context, and expected answers exist |
| D3 | Ingestion pipeline | B | CSV and text input become validated event memories with timestamps, asset IDs, and traceable sources |
| D4 | Persistent memory store | B | Restarting the app preserves history; duplicate imports do not duplicate events; superseded findings remain auditable |
| D5 | Retrieval and grounded answers | C | A query retrieves relevant same-asset history, follows linked repairs and outcomes, and returns source-backed claims or insufficient-evidence responses |
| D6 | Role-specific intelligence | C and A | Operator, technician, and fleet manager receive appropriate views based on the same evidence |
| D7 | Asset workspace | A | Asset selector, timeline, question panel, evidence viewer, upload/replay control, and outcome form work against the backend |
| D8 | Outcome learning loop | B and C | A newly recorded outcome changes retrieval and the answer in a fresh session without manually changing the prompt |
| D9 | Verification results | Ronak with owners | The acceptance scenarios pass; observed results are recorded honestly |
| D10 | Running demo and handoff | A and B | One documented startup command, reset procedure, sample data, and environment variable example are available |
| D11 | Submission and presentation | Ronak with all teammates | Problem, working flow, architecture, evidence of improvement, limitations, credits, and demo recording are ready in the organizer's required format |

## Four person task division

Ronak owns product, data, integration verification, and the demo. Your equipment and robotics familiarity is especially useful for designing a coherent operational story. Teammates A, B, and C own frontend, backend, and intelligence respectively. Reassign these labels based on each person's strengths in the first meeting.

### Ronak product and data

- Write the one paragraph product promise and exact demo script.
- Build the fictional event sequence and source files; keep IDs and timestamps consistent.
- Include a relevant past incident, an unrelated incident, a same-symptom event on another asset, a failed intervention, a successful intervention, and a corrected finding.
- Define expected retrieved event IDs and expected behavior for the verification scenarios.
- Keep a task board, run integration checks, and coordinate scope cuts.
- Draft the presentation while development continues and capture the backup demo.
- Confirm submission format, judging time, allowed services, deadline, and any required disclosures with the organizer materials.

### Teammate A frontend

- Create the asset workspace using a mocked response that follows D1.
- Show chronological history and distinguish observation, hypothesis, confirmed finding, repair, and outcome.
- Add evidence expansion with source excerpt, timestamp, and original record.
- Add role selector, new-event input, and outcome recording.
- Connect to real endpoints as soon as the first backend path works.
- Handle loading, empty history, failed requests, and ingestion status.
- Add a graph view only after the full loop works.

### Teammate B ingestion and backend

- Own canonical records, persistence, source retention, and the API contract.
- Support CSV telemetry and pasted/uploaded text first. PDF extraction and image interpretation are optional additions.
- Reduce telemetry to meaningful anomaly episodes using explicit demo thresholds. Keep raw measurements as evidence; do not index every sample as a separate memory.
- Validate extraction output; never let generated text invent an asset identity or timestamp.
- Store relationships linking incidents, inspections, repairs, outcomes, and corrections.
- Make import processing idempotent through source hashes and stable IDs.
- Expose reset and seed functionality for repeatable demos; keep it clearly separate from normal data ingestion.

### Teammate C memory retrieval and reasoning

- Own the memory adapter and retrieval pipeline.
- Filter by asset and query time before ranking history.
- Rank candidates using symptom relevance, operating context, and recency; fetch linked inspections, interventions, and outcomes.
- Exclude superseded findings from current conclusions while retaining their historical role.
- Generate structured answers with supporting source IDs, uncertainty, and suggested investigation.
- Validate that every cited source exists and was in the retrieved context.
- Implement role-specific presentation without altering underlying facts.
- Demonstrate outcome learning through changed stored history and retrieval, without claiming model-weight training.

## Architecture and implementation decisions

Use the frontend framework the team already knows. A React or Next.js workspace plus a Python FastAPI backend is a reasonable default if everyone is comfortable with it. Use one relational store: SQLite for a single-process local demo or your existing hosted PostgreSQL setup if already working. Retain source files separately and store their stable identifiers in the database.

Canonical event records and relations are the source of truth. Semantic search is an index over them. A visual graph does not require a dedicated graph database: an edges table can represent the demo's relationships.

Mem0 is an optional retrieval adapter, not a substitute for raw sources, timestamps, repair outcomes, or your event schema. Its documentation describes adding and searching memories and metadata scoping. Try a single add/search example for at most 30 minutes. If account setup, indexing, or behavior blocks the team, use direct embeddings and local similarity search, then fetch canonical records by ID. For a very small dataset, a structured keyword/context baseline is an acceptable fallback, disclosed honestly.

Only one component writes canonical records: the backend. Frontend and intelligence modules interact through the agreed endpoints. Keep model keys on the backend.

Flow: sources â†’ validated events â†’ persistent events and relations â†’ filtered retrieval â†’ linked context â†’ grounded role-specific answer â†’ human outcome â†’ updated persistent history.

Recommended module boundaries: frontend; backend/api; backend/ingestion; backend/storage; backend/memory; shared/contracts; demo/data; demo/evaluation. Everyone commits a small working change early and integrates at least every two hours.

## Shared data contract

Minimum records:

- Asset: asset_id, display_name, equipment_type, site_id, configuration_version.
- Source: source_id, source_type, original filename or record reference, original text/measurements, received_at, content_hash.
- Event: event_id, asset_id, site_id, occurred_at, recorded_at, event_type, summary, component, symptoms, measurements with units, environmental_context, evidence_source_ids, status, configuration_version when known.
- Relation: from_event_id, relation_type, to_event_id, evidence_source_ids, verification_status.
- Outcome: event_id, related_incident_id, action_taken, observed_result, recorded_by, occurred_at, evidence_source_ids, supersedes_event_id when applicable.
- Answer: answer, observations, hypotheses, suggested_checks, relevant_event_ids, citations with source_id and supporting excerpt, uncertainties, role.

Use UTC ISO timestamps; show local time in the UI. Separate the time an event happened from the time somebody entered it. Distinguish unknown fields from inferred fields. Preserve units. For current queries, retrieve only events available as of the query time, preventing future-outcome leakage in evaluations.

Relation types can start with observed_at, followed_by, investigated_by, addressed_by, outcome_of, and supersedes. Avoid asserting caused_by unless a source explicitly establishes that finding.

Suggested API contract:

| Endpoint | Purpose | Key result |
|---|---|---|
| GET /assets | List assets | Asset records |
| GET /assets/{id}/events | Return timeline with optional as_of | Event records and source links |
| POST /ingest | Accept source, asset ID, and source type | Ingest ID, status, event IDs, validation errors |
| GET /ingest/{id} | Track processing if asynchronous | Pending, complete, or failed |
| POST /query | Accept asset_id, role, question, as_of | Structured answer and citations |
| POST /outcomes | Record human finding/action/result | New outcome ID and linked incident ID |
| GET /sources/{id} | Open original evidence | Source record or file |
| GET /assets/{id}/relations | Optional graph UI | Nodes and evidence-backed edges |

Agree on exact JSON examples and errors before implementing. A synchronous ingest response is fine if processing is short; remove the status endpoint in that case. Provide a health endpoint for startup diagnosis.

## Schedule from the moment work begins

| Elapsed time | Shared milestone | Parallel work |
|---|---|---|
| 0â€“0.5 hours | Scope, owners, schemas, repository, and credentials settled | All agree on D1 and sample JSON |
| 0.5â€“2 hours | First connected path | A uses mocked UI; B stores and serves one event; C retrieves and answers from one event; Ronak builds data |
| 2â€“5 hours | Complete basic loop | Ingest â†’ persist â†’ query â†’ citation â†’ outcome; connect frontend to backend |
| 5â€“8 hours | Required demo capabilities | Temporal ordering, linked repairs/outcomes, asset isolation, correction handling, role-specific views |
| 8â€“11 hours | Verified lifecycle | Run cases below, fix retrieval, restart the app, replay the demo |
| 11â€“12 hours | Choose one stretch feature | Graph view or one multimodal input only if core is stable |
| 12â€“14 hours | Feature freeze | Fix failures, finish instructions, presentation, and demo recording |
| 14â€“16 hours | Rehearse and submit | Verify required fields, rehearse to actual time limit, retain submission buffer |

At hour 2, an event must already reach the UI through the backend. At hour 5, the whole loop must work, even with plain styling. If either milestone slips, cut features immediately. For a shorter window, remove the stretch block and compress scope, not the submission buffer. Schedule short staggered breaks so teammates retain enough attention for integration.

## Verification plan

Create about ten fixed questions with expected event IDs. Include both straightforward retrieval and cases that test memory evolution. Record retrieval hits and whether each generated factual claim is supported. A small demonstration set is not proof of broad predictive accuracy.

1. Relevant history: the same-asset past incident, intervention, and outcome are retrieved.
2. Distractor: an unrelated recent incident does not crowd out the relevant older event.
3. Asset isolation: same-symptom history from another asset is excluded unless the user explicitly asks for fleet comparison.
4. Temporal order: an earlier as_of query does not access a later repair outcome.
5. Outcome learning: adding a human outcome changes a fresh-session answer and its cited events.
6. Correction: a superseded diagnosis is described as an earlier hypothesis, not a current confirmed fact.
7. Persistence: restart backend and open a new session; memories remain.
8. Idempotence: import the same source twice; timeline contains one instance of each event.
9. Insufficient evidence: the system acknowledges missing evidence rather than inventing a repair or source.
10. Role consistency: three role views share facts and evidence while changing emphasis.

Compare a current-event-only baseline against the memory-enabled path using the same model and question. Score retrieval accuracy, source support, correct use of outcomes, and missing-evidence handling. Report observed counts, not invented improvement percentages. Keep measured response latency as a separate practical metric.

## Priorities and scope cuts

Required: structured ingestion; persistent per-asset history; relevant retrieval; linked outcomes; citations; role-specific answers; a real outcome write; a fresh-session demonstration.

First cut if behind: voice, AR/VR, raw LiDAR processing, long video analysis, live hardware, fine-tuning, multiple agent orchestration, dedicated graph database, elaborate authentication, and many ingestion formats. None is necessary to prove this lifecycle.

One stretch choice: clickable cognitive map showing incident â†’ inspection â†’ intervention â†’ outcome, or image upload linked to an existing incident with a reviewed observation. Avoid implementing both before rehearsal.

Human and agent collaboration can be shown by an assistant assembling the relevant history and proposing an inspection summary, then a human reviewing and recording the outcome. Automated machine control and unapproved repair execution are outside this demo's scope.

## Demo and submission outline

Prepare a three minute version and shorten or extend it to the organizer's actual limit:

- 0:00â€“0:25: Explain the fragmented-history problem and technician use case.
- 0:25â€“0:55: Show the asset history and evidence.
- 0:55â€“1:35: Replay a new incident; ask for an explanation; open its citations.
- 1:35â€“1:55: Switch roles to show personalized intelligence.
- 1:55â€“2:35: Record an outcome, open a fresh session, and show the revised answer.
- 2:35â€“3:00: Show architecture, actual verification results, prototype boundaries, and next step.

Prepare a concise deck or submission narrative covering problem, user, working product, memory lifecycle, results, and future work. Label synthetic data and simulated telemetry visibly. Record a backup of the genuinely working flow. If services fail during judging, describe the recording as a recording; do not disguise cached output as a live model response.

## Immediate starting checklist

1. Assign A, B, and C to the teammates and confirm Ronak's ownership.
2. Choose one equipment scenario and freeze the must-have list.
3. Create the shared repository and task board; commit schema examples.
4. Confirm one model call and one memory add/search attempt; apply the 30 minute fallback limit.
5. Agree on sample query and outcome requests and responses.
6. Start the four workstreams using the same fixture data.
7. Set the first integration checkpoint for two hours from now.

## Technical references

- Mem0 quickstart: https://docs.mem0.ai/platform/quickstart
- Mem0 memory search and scoping: https://docs.mem0.ai/core-concepts/memory-operations/search
- FastAPI file uploads: https://fastapi.tiangolo.com/tutorial/request-files/

Check the installed SDK's current interface when implementing. These references support the optional integrations, not the fictional equipment story or claimed performance.
