import type {RiskCohortProof, RiskLabSnapshot} from './risk-lab-types';

// Observed provider API evidence and immutable controlled-cohort artifacts.
export const riskProviderProof: RiskLabSnapshot['providerProof'] = {
  "blockCheck": {
    "status": "verified",
    "checkedAt": "2026-10-17T18:42:56.039881+00:00",
    "evidenceUrl": "/proofs/block-check.json",
    "summary": "PRISM independently classified all 38 blocked cohort runs as honoured: no downstream model execution. This is a recorded API readback, linked to the exact traces below.",
    "traceIds": [
      "ed943cd1-2008-40ab-8efe-457d8a32d7fb",
      "28b23b28-80d9-4aa6-881f-7ab16eb66577",
      "d477266d-1df0-4697-8718-10772ac80310",
      "69f34f0f-66e0-4070-b531-7def4d24b8ad",
      "3af76050-09c0-4f11-a82b-9c0736fe6cf8",
      "c3d297a0-49a4-4dda-a3dc-dadb931a952b",
      "e5634e31-941a-42ed-adf9-914e956d45b5",
      "881f35c5-8075-488f-bd3f-152dc1655f13",
      "923c9f16-2775-49eb-8061-501c84dff2e3",
      "c17d8e13-7371-49b0-86ad-8670acb46cb9",
      "5ac087a5-c224-46ea-955f-1732ceb37b1f",
      "13e89aae-acaa-456c-b094-bd56dbc19c80",
      "56d6e48a-006e-460c-a743-f509f0b07ad9",
      "9d11d1ef-e070-42be-a428-9531b7864ad9",
      "fdab96d5-a973-4fbc-aeee-bc0efe53b6d8",
      "23d4e9cb-601a-49cd-a63f-9b9b1f935670",
      "85638a63-1a6f-4607-afe2-48abd42b6252",
      "6fea0961-ffbb-44f5-acab-74bf5c9ffe54",
      "d73b9b48-bb7f-48aa-b693-db5df8e7362c",
      "966d9fc7-17ff-4bd8-8e27-230ef30b7a09",
      "4b25b3b8-04fd-4ed8-a5d7-25e9ac23b66d",
      "402b25b4-151d-4ec9-86c0-b9a84d8d5643",
      "698460b3-1c87-4c10-b07a-06d00b2801cf",
      "15fdf85e-bf06-48cc-8963-ae09776feaf8",
      "a21f0c51-f170-478e-a91c-f645d203de56",
      "28919145-0d64-4039-a24a-a0d258ec4bd3",
      "d1acea2a-8305-459a-b0cb-0a72f133fa29",
      "e1410ac2-b61b-4426-afed-b2b546b8d600",
      "d5a99a65-a61b-4c43-bbbc-e9864327caa6",
      "5dd7ec62-f115-4f54-8938-99b66ca94f02",
      "c29aa9a8-561f-4c03-857f-e3c447288651",
      "64df547b-e815-420d-bd43-b249f139ead1",
      "81c8d361-96c8-412d-b941-08cc89fa4730",
      "781e2364-be96-4537-96b7-24563e4946e3",
      "b8faf9e5-becf-450b-8d83-1dc9cdea5b80",
      "cbfecd6f-523c-45e5-bde1-b6609b16d2e8",
      "22bc5240-6ffc-4465-bcd4-5e32159696ad",
      "d0583824-1964-49c9-a41c-f1e40050da5f"
    ]
  },
  "rootCause": {
    "status": "unverified",
    "checkedAt": "2026-10-17T18:42:31.863761+00:00",
    "evidenceUrl": "/proofs/analysis-provider-error.json",
    "summary": "Root Cause proof is incomplete. PRISM deep analysis failed for all 10 selected blocked traces: its upstream model provider returned an authentication error. Guardrail enforcement and Nicrron inference succeeded."
  }
};

export const riskCohortProof: RiskCohortProof = {
  "capturedAt": "2026-10-17T18:41:33.201Z",
  "snapshotHash": "58f02d05115947bc18fb5c938b34c13cf1c31f3e43d0a3d60dbac0f00106929c",
  "evidenceUrl": "/proofs/cohort-comparison.json",
  "caseCount": 4,
  "methodology": "Same four fixed requests repeated across 50 real calls. Baseline skips only the PRISM pre-model gate in a shadow CLI with no order tools. The model retains its safety prompt. A risky request reaching the model is a boundary failure, not proof of harmful output. Protected replay uses the same frozen Yahoo input.",
  "baseline": {
    "runs": 50,
    "riskyModelCalls": 38,
    "blocked": 0,
    "benignCompleted": 12,
    "tracesAcknowledged": 50,
    "spansAcknowledged": 50
  },
  "protected": {
    "runs": 50,
    "riskyModelCalls": 0,
    "blocked": 38,
    "benignCompleted": 12,
    "tracesAcknowledged": 50,
    "spansAcknowledged": 50
  }
};
