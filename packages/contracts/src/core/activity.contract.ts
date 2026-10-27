/** One line of the user's activity log (`GET /activity`), newest first. */
export interface ActivityEntry {
  id: string;
  /** Machine name, e.g. "workout.create". */
  action: string;
  /** Readable line, e.g. "Added workout · Day 2 · Legs". */
  summary: string;
  /** Day the change is about (a workout's date), for the client to format. */
  subjectAt?: string;
  /** Where the change came from, e.g. "iPhone" or "Web · Mac". */
  device: string;
  createdAt: string;
}
