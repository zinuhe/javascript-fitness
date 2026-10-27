import type { ActivityEntry } from '@fitness/contracts';

export interface RecordActivityData {
  userId: string;
  action: string;
  summary: string;
  subjectAt?: Date;
  device: string;
}

export interface ActivityRepository {
  record(data: RecordActivityData): Promise<void>;
  /** The user's latest entries, newest first. */
  findRecentForUser(userId: string, limit: number): Promise<ActivityEntry[]>;
}

export const ACTIVITY_REPOSITORY = Symbol('ACTIVITY_REPOSITORY');
