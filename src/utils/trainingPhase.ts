import type { TrainingPhaseInfo } from '../types';

export type TrainingPhase = 'neural' | 'transition' | 'hypertrophic';

export function getTrainingPhase(weeksTraining: number): TrainingPhaseInfo {
  if (weeksTraining < 3) {
    return {
      phase: 'neural',
      title: 'Neural Adaptation Phase',
      description:
        'Most of your strength gains right now come from your nervous system learning to recruit muscle more efficiently - not from muscle growth. This is normal and expected. Hypertrophy is beginning at the cellular level but is not yet detectable by most measurement methods.',
      citation: 'Moritani & deVries 1979; Sale 1988',
    };
  }

  if (weeksTraining < 8) {
    return {
      phase: 'transition',
      title: 'Transition Phase',
      description:
        'Measurable muscle growth is now contributing to your strength gains alongside continued neural adaptations. One study detected significant quadriceps size increases by day 20 of training. Both mechanisms are active - strength gains reflect a mix of skill, neural drive, and actual muscle tissue.',
      citation: 'Seynnes et al. 2007; Damas et al. 2016',
    };
  }

  return {
    phase: 'hypertrophic',
    title: 'Hypertrophy-Driven Phase',
    description:
      'Muscle growth is now an increasingly important driver of continued strength gains, though neural factors remain significant - especially for 1RM performance where coordination matters. One study found ~40% of force increase was attributable to hypertrophy after 60 days of training.',
    citation: 'Narici et al. 1996; Sale 1988',
  };
}
