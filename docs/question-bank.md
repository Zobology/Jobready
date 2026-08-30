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

An assembled assessment draws 10 core items, 8 role items, 5 industry items, and one integrated simulation. Previously used core items are deprioritized so a candidate taking assessments for multiple role–industry targets receives a fresh core section until the available variants are exhausted.

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
