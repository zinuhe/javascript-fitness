import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ActivityEntry } from '@fitness/contracts';
import { ACTIVITY_REPOSITORY, type ActivityRepository } from '../domain/activity.repository';
import { deviceFrom } from './device';

export interface ActivityInput {
  userId: string;
  action: string;
  summary: string;
  /** Day the change is about (a workout's date). */
  subjectAt?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(@Inject(ACTIVITY_REPOSITORY) private readonly activity: ActivityRepository) {}

  /**
   * Adds a line to the user's log. Called after the change succeeded; a failure here is
   * only logged, so it never undoes or fails the user's change.
   */
  async record(input: ActivityInput): Promise<void> {
    try {
      await this.activity.record({
        userId: input.userId,
        action: input.action,
        summary: input.summary,
        subjectAt: input.subjectAt ? new Date(input.subjectAt) : undefined,
        device: deviceFrom(input.userAgent),
      });
    } catch (error) {
      this.logger.warn(`Could not record activity "${input.action}": ${String(error)}`);
    }
  }

  recent(userId: string, limit: number): Promise<ActivityEntry[]> {
    return this.activity.findRecentForUser(userId, limit);
  }
}
