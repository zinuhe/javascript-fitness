import { ActivityService } from './activity.service';
import type { ActivityRepository } from '../domain/activity.repository';

describe('ActivityService.record', () => {
  let repo: jest.Mocked<ActivityRepository>;
  let service: ActivityService;

  beforeEach(() => {
    repo = { record: jest.fn().mockResolvedValue(undefined), findRecentForUser: jest.fn() };
    service = new ActivityService(repo);
  });

  it('stores the line with the device the request came from', async () => {
    await service.record({
      userId: 'user-1',
      action: 'workout.create',
      summary: 'Added workout',
      subjectAt: '2026-07-16T16:00:00.000Z',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)',
    });

    expect(repo.record).toHaveBeenCalledWith({
      userId: 'user-1',
      action: 'workout.create',
      summary: 'Added workout',
      subjectAt: new Date('2026-07-16T16:00:00.000Z'),
      device: 'iPhone',
    });
  });

  it('never fails the change it describes', async () => {
    repo.record.mockRejectedValue(new Error('db down'));

    await expect(
      service.record({ userId: 'user-1', action: 'workout.create', summary: 'Added workout' }),
    ).resolves.toBeUndefined();
  });
});
