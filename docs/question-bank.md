# Zobology question bank

The bank is generated from every tab in `Job_Readiness_Role_Industry_Master_Matrix_V1` and preserves its reusable Core + Role + Industry + Role × Industry architecture.

## Coverage

| Bank layer | Coverage | Items |
| --- | ---: | ---: |
| Core | 8 competencies × 4 evidence tasks | 32 |
| Role | 490 role competencies × knowledge/application | 980 |
| Industry | 361 context areas × knowledge/application | 722 |
| Role × Industry | 90 roles × 60 industries | 5,400 |
| **Total** |  | **7,134** |

An assembled assessment draws 3 core items, 5 role items, 2 industry items, and one separate integrated simulation. The ten standard questions contain two audio responses, three Excel exercises, two written-communication tasks, and three situational tasks. Previously used core items are deprioritized so a candidate taking assessments for multiple role–industry targets receives fresh core evidence until the available variants are exhausted.

## Work-sample design rules

- Every assembled question now has four structured design anchors: a real role-task archetype, an industry operating situation, a level-specific authority boundary, and an observable work product. These are stored as `task-*`, `industry-situation-*`, `authority-*`, and `work-product-*` tags for auditing and evaluation analysis.
- Role-task libraries cover live cases, analysis, planning, control, communication, coordination, and decision work across each role family. Industry packs supply real workflows, evidence sources, operating events, and constraints; role-aware overlays prevent, for example, a Talent Acquisition question in Hospitals from becoming a patient-care task.
- Response formats are matched to observable capabilities instead of being assigned only by question order. For example, a sales assessment uses audio for persuasion, Excel for conversion analysis, and written communication for customer follow-up.
- The three Core questions are independently contextualized to the selected role and industry: a delivered spoken update, a foundational Excel analysis with role-relevant measures, and a finished evidence-led workplace email. They do not reuse the same generic prompt across job profiles.
- Questions in one assessment must require different work outputs; changing only the competency label or wording is not a distinct question.
- Scenarios state the information, constraints, authority, audience, and expected output needed to answer without inventing an entire workplace context.
- Entry-level tasks focus on execution within the candidate's authority and make approval or escalation explicit. Higher levels add independent ownership, trade-offs, governance, and strategic impact.
- Role questions combine a role-family operating situation with a competency-specific proof artifact. The generator covers analytical, commercial, customer, people, operations, technology, governance, communications, advisory, and coordination work rather than merely inserting a competency name into one common case.
- Industry questions use operating-risk patterns for financial services, technology, consumer, healthcare, industrial, energy/infrastructure, logistics/travel, media, professional services, education, hospitality, and public/social-impact sectors.
- Integrated simulations use the actual workflow of the target role family—such as triaging customer cases, resolving a release issue, prioritizing sales opportunities, rebuilding a project plan, or preparing a control decision.
- Runtime design validation and an exhaustive regression check generate all 90 roles × 60 industries × 4 levels and reject missing design anchors, authority mismatches, near-duplicate work samples, generic fallback context, missing observable outputs, incorrect format mixes, unsynchronized prompts, and missing seniority boundaries.

## Required tags

Every item carries:

- `id`: stable bank identifier such as `R007-I014-SIM-01`
- `dimension`: `core`, `role`, `industry`, or `role_industry`
- `competency`: the capability or context being assessed
- `roleId` and `industryId` when applicable
- `proficiency`: `foundation`, `developing`, `job_ready`, or `advanced`
- `assessmentModes`: one or more of `knowledge`, `application`, `subjective`, `audio`, and `simulation`
- `responseType`: `written` or `audio`
- `rubric`: observable criteria used to evaluate the response
- `diagnosticTags`: gaps the item can diagnose
- `sourceTab`: workbook provenance
- `tags`: searchable dimension, role, industry, competency, and mode labels

## Diagnostic tags

- `knowledge_gap`: the candidate does not demonstrate required concepts or terminology
- `skill_gap`: the candidate understands the concept but cannot demonstrate the functional skill
- `application_gap`: the candidate cannot apply knowledge to a realistic workplace situation
- `communication_gap`: the response lacks clarity, structure, audience awareness, or delivery effectiveness
- `industry_exposure_gap`: the reasoning does not reflect the target industry's context, signals, risks, or operating model

## Simulation structure

Each role × industry combination contains a realistic performance signal, role-specific directive, industry focus, prioritization requirement, KPI requirement, and a 60–90 second audio follow-up. Simulations are tagged to diagnose role application, industry exposure, judgement, and communication separately.
