export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  primary_muscle: string;
  secondary_muscles: string; // JSON array
  category: 'strength' | 'cardio';
  met: number | null;
  is_custom: number;
  is_archived: number;
}

export interface RoutineFolder { id: number; name: string; position: number }

export interface Routine {
  id: number;
  folder_id: number | null;
  name: string;
  notes: string;
  position: number;
  created_at: number;
  archived_at: number | null;
}

export interface RoutineExercise {
  id: number;
  routine_id: number;
  exercise_id: string;
  position: number;
  notes: string;
  rest_seconds: number | null;
}

export interface RoutineSet {
  id: number;
  routine_exercise_id: number;
  position: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_duration_s: number | null;
}

export interface Workout {
  id: number;
  routine_id: number | null;
  name: string;
  started_at: number;
  finished_at: number | null;
  duration_s: number | null;
  notes: string;
  total_volume_kg: number;
  total_sets: number;
  pr_count: number;
  calories_kcal: number;
}

export interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: string;
  position: number;
  notes: string;
  rest_seconds: number | null;
}

export interface WorkoutSet {
  id: number;
  workout_exercise_id: number;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  is_completed: number;
  completed_at: number | null;
}

export type PrKind = 'weight' | 'e1rm' | 'set_volume' | 'reps' | 'duration';

export interface PersonalRecord {
  id: number;
  exercise_id: string;
  workout_set_id: number | null;
  workout_id: number | null;
  kind: PrKind;
  value: number;
  achieved_at: number;
}
