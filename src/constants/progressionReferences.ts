export interface ProgressionReferenceSegment {
  fromWeek: number;
  toWeek: number;
  rateKgPerWeek: number;
}

export interface ProgressionReference {
  exerciseId: string;
  label: string;
  citation: string;
  caveat: string;
  segments: ProgressionReferenceSegment[];
}

export const progressionReferences: ProgressionReference[] = [
  {
    exerciseId: 'barbell-bench-press',
    label: 'Ogasawara et al. 2012 (n=7)',
    citation:
      'PMC3831787 - 7 untrained men, bench-only program, 3x/wk for 24 weeks.',
    caveat:
      'Single small study, bench-press-only program, lighter bodyweight cohort (65 kg avg). Your program and body differ - treat as loose context, not a target.',
    segments: [
      { fromWeek: 0, toWeek: 6, rateKgPerWeek: 1.7 },
      { fromWeek: 6, toWeek: 12, rateKgPerWeek: 1.25 },
      { fromWeek: 12, toWeek: 18, rateKgPerWeek: 0.8 },
      { fromWeek: 18, toWeek: 24, rateKgPerWeek: 0.65 },
    ],
  },
  {
    exerciseId: 'barbell-back-squat',
    label: 'Spence et al. 2011 (n=13)',
    citation:
      'PMC3240883 - 13 untrained men, supervised full-body RT, 24 weeks. Only pre/post 1RM reported (no intermediate timepoints).',
    caveat:
      'Only a 24-week average rate - no monthly breakdown exists. Early gains were likely faster, later gains slower, but this cannot be verified from the published data.',
    segments: [{ fromWeek: 0, toWeek: 24, rateKgPerWeek: 1.74 }],
  },
];
