## Problem Statement

People who read dense PDFs for self-directed learning often capture thoughts in disconnected ways: highlights in one place, notes somewhere else, AI chats in another tool, and sketches nowhere durable. That split makes later retrieval slow and unreliable. The user does not want to build or maintain a heavyweight knowledge-management framework just to stay organized while reading. They want a lightweight memory layer directly on top of the document so they can return later, click the relevant evidence, and immediately recover what they thought, asked, summarized, or sketched within the context of a project.

## Solution

Anchor is a project-based, document-native research and learning workspace. A user creates a project, attaches one or more PDF documents, reads a PDF, and creates anchors on text selections or screenshot regions. Each anchor is a persistent memory container attached to a precise region of the document. When the user revisits the document later, saved anchors appear directly on the reading surface as highlights or outlined regions. Opening an anchor shows an in-app floating stack of artifact cards, with summaries surfaced first and the remaining artifacts available by flipping through the stack.

The product is optimized for future retrieval, not just momentary interaction. The document remains the primary surface, and memory is recovered through the evidence itself rather than through a separate dashboard-first workflow.

## User Stories

1. As a self-directed learner, I want to create a project before I start reading, so that my work is organized around a clear research container.
2. As a self-directed learner, I want to attach a PDF to a project, so that I can read and annotate it in one place.
3. As a returning reader, I want to reopen a project and its PDF with prior anchored regions visible, so that I can immediately see where I left meaningful context.
4. As a reader, I want to select text and see a tool pill, so that I can choose how to capture my thought without extra setup.
5. As a reader, I want to mark a rectangular screenshot region, so that I can anchor non-textual or layout-specific evidence.
6. As a reader, I want no anchor to be created if I dismiss the tool pill, so that accidental selections do not clutter the document.
7. As a reader, I want choosing a tool to begin an anchor workflow, so that anchor creation feels implicit and lightweight.
8. As a reader, I want one anchor to contain multiple artifacts over time, so that all related memory about one passage stays together.
9. As a reader, I want reselecting the exact same region to reopen the existing anchor, so that I do not create duplicate memory containers.
10. As a reader, I want exact matching rather than fuzzy reattachment, so that anchor behavior stays predictable in v1.
11. As a reader, I want reselecting the same region to let me add another artifact to that anchor, so that I can keep extending prior work.
12. As a reader, I want saved text anchors to remain highlighted, so that I can recognize prior memory locations while scanning.
13. As a reader, I want screenshot anchors to remain visually outlined, so that I can recognize region-based memory at a glance.
14. As a reader, I want saved anchor styling to differ from temporary selection styling, so that I can tell committed memory from transient interaction.
15. As a reader, I want to open an anchor in an in-app floating stack, so that I can inspect memory without losing my place in the document.
16. As a reader, I want all anchor artifacts to appear together as a bunched-up card stack, so that retrieval feels like opening a compact memory bundle.
17. As a reader, I want summaries to appear on top of the stack, so that I can recover prior understanding quickly before inspecting lower-priority artifacts.
18. As a reader, I want to flip through the stack to reveal all artifacts for an anchor, so that I can browse everything tied to the same evidence.
19. As a reader, I want to attach a note to an anchor, so that I can save plain-language understanding in context.
20. As a reader, I want to attach a summary to an anchor, so that I can store a quick retrieval-oriented explanation.
21. As a reader, I want to attach a chat artifact to an anchor, so that AI exploration remains tied to evidence rather than floating away from it.
22. As a reader, I want to attach a sketch to an anchor, so that visual thinking can live beside text and chat.
23. As a user, I want pre-confirmation tool interactions to stay client-side, so that abandoned work does not create ghost records.
24. As a user, I want the first explicit confirmation to create the artifact in storage, so that persistence reflects deliberate intent.
25. As a user, I want all later edits to autosave regardless of artifact type, so that committed work is preserved without constant manual saves.
26. As a chat user, I want AI assistance to exist only inside chat artifacts, so that the rest of the product stays lightweight and predictable.
27. As a user, I want my PDFs to be immutable once uploaded, so that anchors remain attached to a stable document surface.
28. As a user, I want a document record to represent the uploaded PDF and its metadata, so that the app can reliably reopen and scope anchored memory.
29. As a user, I want projects to group related documents and memory, so that research can be organized above the individual PDF level.
30. As a user, I want anchors to belong to a document, so that each memory container is clearly tied to a specific reading surface.
31. As a user, I want child artifacts to belong to an anchor, so that notes, summaries, chats, and sketches stay grouped under evidence.
32. As a user, I want chat messages to belong to a chat artifact, so that conversation history is structured and appendable.
33. As a user, I want screenshot-style anchors to store coordinates against the source PDF rather than saved image crops, so that artifact storage stays lean and tied to the document surface.
34. As a user, I want document loading to fetch only what is needed for the visible reading area, so that large PDFs remain responsive.
35. As a user, I want full anchor details to load only when I open an anchor, so that recall is fast without overfetching.
36. As a user, I want document upload to include metadata extraction, so that page-scoped reading and anchor behavior are reliable.
37. As a user, I want anchor creation to be unavailable until a document is ready, so that anchors are never attached to unstable processing state.
38. As a user, I want a failed upload or processing attempt to remain visible as a failed status, so that the system is honest about document readiness even without retry logic in v1.
39. As a user, I want my data to be scoped to my account, so that my private reading history stays private.
40. As a user, I want authorization enforced at both the app layer and database layer, so that ownership is not dependent on a single protection boundary.
41. As a user, I want to edit an existing artifact, so that I can refine my saved understanding over time.
42. As a user, I want to edit an anchor in place, so that I can correct or adjust a memory container without recreating it.
43. As a user, I want deleting an artifact to remove only that memory child, so that other anchor content remains intact.
44. As a user, I want deleting an anchor to remove all of its child artifacts, so that anchor cleanup is coherent.
45. As a user, I want deleting a document to cascade through its memory structures and eventually remove stored files, so that storage does not accumulate orphaned data.
46. As a future user, I want the product architecture to support richer retrieval later, so that v1 does not box the product into a shallow schema.

## Implementation Decisions

- The primary domain hierarchy is `user -> project -> document -> anchor -> child artifacts`.
- A project is the top-level user-owned workspace for related document reading and memory.
- A document is an app-managed uploaded PDF stored in Supabase Storage with a durable database record and extracted metadata.
- Documents are immutable after upload. Replacing the underlying file is not allowed in place because anchors depend on the exact document surface.
- Document lifecycle includes explicit readiness states such as uploading, processing, ready, and failed.
- Anchors are the primary product entity. They represent persistent memory containers attached to document evidence.
- V1 document support is limited to PDFs.
- V1 anchor region types are limited to text selections and rectangular screenshot regions.
- Text anchor matching in v1 is exact-match only. The system should not attempt fuzzy reattachment when a selection cannot be matched exactly.
- Rectangular screenshot regions are stored as coordinate references back into the PDF surface rather than as persisted image crops.
- Anchor data should stay lean and focus on redraw and relocation needs. AI-oriented context is a separate concern and should not be folded into anchor identity.
- Anchors are editable in place in v1 and should carry normal timestamps rather than full version history.
- Artifact persistence follows a commit boundary: opening a tool does not create a database row; the first meaningful confirmation creates the artifact.
- After an artifact is created, all later edits autosave regardless of artifact type.
- Artifact types are a closed enum in v1: note, summary, chat_thread, and sketch.
- An anchor may contain multiple child artifacts of any type in v1. The data model should allow multiplicity even if later UI versions group or prioritize them.
- Chat is treated as just another artifact type in the anchor model, even though it is the only artifact that invokes AI behavior.
- Child artifacts should use a shared artifact table with common metadata plus typed JSON payloads for artifact-specific content.
- Chat threads should be modeled as artifacts with message contents stored separately in a structured chat messages table.
- Reader loading should be page-scoped. Document reads should fetch metadata first, then anchors by visible page range, and only fetch full anchor detail when an anchor is opened.
- Anchor discovery is spatial first and chronological second. No manual order field is required in v1.
- The anchor-open interaction should use a floating card-stack presentation. V1 does not include side-panel docking or badge-driven artifact navigation.
- Within the stack, summaries should be surfaced first, and the remaining artifacts should be accessible by flipping through the stack.
- Deletion should be soft-delete oriented in the relational layer, with later asynchronous cleanup of storage objects for deleted documents.
- Failed documents should remain in a failed state in v1 without retry or replace flows.
- Ownership and access control should be enforced in both the application layer and the database layer, including row-level security in Supabase-backed tables and user-namespaced storage organization.
- Major modules to build or extend are listed below.
- Project/document management module: handles project creation and the association between projects and uploaded documents.
- Document ingestion module: handles PDF upload orchestration, metadata extraction, storage references, and document status transitions.
- Document reader module: renders the reading surface, handles visible page ranges, and coordinates anchor hydration.
- Anchor region module: defines region selection, anchor redraw, exact same-region matching, and anchor edit behavior.
- Anchor workspace module: manages the in-app floating card stack, active anchor state, and artifact presentation.
- Artifact persistence module: owns creation, autosave, edit, soft deletion, and typed payload handling across note, summary, sketch, and chat thread artifacts.
- Chat thread module: encapsulates thread creation, message append behavior, AI interaction, and retrieval for anchor-bound conversations.
- Authorization module: centralizes authenticated ownership checks and data-layer policy assumptions.
- The implementation should favor deep modules with simple interfaces around project/document management, ingestion, region modeling, artifact persistence, and chat threads, so the UI does not accumulate persistence-specific branching logic.

## Testing Decisions

- Good tests should verify externally observable behavior rather than implementation details. They should prove that the system preserves the anchor-memory relationship, honors ownership, and returns the right data for reading and retrieval flows.
- The project/document management and document ingestion modules should be tested for project scoping, status transitions, metadata extraction outcomes, failed-state handling, and rejection of anchor creation before readiness.
- The anchor region module should be tested for creation rules, exact same-region reuse behavior, redraw payload shape, coordinate-region handling, and in-place edit behavior.
- The artifact persistence module should be tested for the commit boundary, uniform autosave-after-confirmation behavior, multiplicity rules, edit flows, and soft deletion behavior.
- The chat thread module should be tested for first-confirmation creation, message append persistence, AI-bound behavior, and retrieval under an anchor.
- Reader-facing API behavior should be tested for page-scoped anchor loading and lazy anchor-detail hydration contracts.
- Authorization should be tested through ownership boundaries, ensuring one user cannot read or mutate another user's project, document, or anchor memory.
- Because the codebase is still scaffold-level, prior art inside the repo is minimal. Tests should therefore establish clear contract-focused patterns now, especially around domain services and API procedures, so future features follow the same style.
- Initial test priority should focus on document ingestion, artifact persistence, and authorization boundaries.

## Out of Scope

- Broad document collaboration or shared workspaces
- Non-PDF document support
- External file references as first-class documents
- In-place file replacement or document version migration
- Free-position manual pins outside text or rectangular region anchors
- Global knowledge dashboards as the primary retrieval surface
- Rich artifact grouping, ranking, or primary-summary selection beyond summaries surfacing first in the stack
- Full conflict resolution across tabs or simultaneous sessions
- Advanced AI memory synthesis across multiple anchors or documents
- Full trash/restore UX
- Arbitrary artifact types beyond the closed v1 set
- Production-grade search and cross-document retrieval systems
- Retry or replace flows for failed document processing
- Side-panel artifact docking

## Further Notes

- The central design principle is that memory is recovered through the document surface, not detached from it.
- The main success criterion for v1 is future retrieval speed and confidence: a user should reopen a dense document and quickly recover what mattered, why it mattered, and what they previously thought.
- The product should remain lightweight for ad-hoc learners. Any workflow that starts to resemble maintaining a separate knowledge-management framework should be treated as suspect.
- This PRD assumes a project can contain multiple PDFs based on the product framing around projects. If the intended model is one PDF per project, the hierarchy and user stories should be simplified in a follow-up edit.
