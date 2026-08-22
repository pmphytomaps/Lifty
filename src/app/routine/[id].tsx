import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { RoutineEditor } from './_editor';

export default function EditRoutine() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoutineEditor routineId={Number(id)} />;
}
