import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Classrooms · NextGen Grader' };

/** `/classrooms`: the student's Classrooms. Only the app header (from the layout) for now. */
export default function ClassroomsPage() {
  return <main className="bg-background flex-1" />;
}
