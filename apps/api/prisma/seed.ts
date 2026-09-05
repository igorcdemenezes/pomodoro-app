/**
 * Development seed.
 *
 * Creates a demo account with enough history for the dashboard, statistics and
 * history screens to render something meaningful on first run, so the
 * application can be evaluated without manually producing weeks of focus time.
 *
 * Idempotent: re-running replaces the demo account rather than accumulating
 * duplicates.
 */
import { PrismaClient, SessionKind, SessionStatus, TaskStatus } from '@prisma/client';

import { hashPassword } from '../src/common/crypto/password';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@pomodoro.app';
const DEMO_PASSWORD = 'demo1234';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number, hour: number): Date {
  const date = new Date(Date.now() - days * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  // Cascading deletes clear projects, tasks and sessions with the owner.
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      projects: {
        create: [
          { name: 'Deep Work', color: '#2A78D6' },
          { name: 'Studies', color: '#EB6834' },
          { name: 'Side Project', color: '#1BAF7A' },
        ],
      },
    },
    include: { projects: true },
  });

  const [deepWork, studies, sideProject] = user.projects;

  const tasks = await Promise.all(
    [
      {
        projectId: deepWork.id,
        title: 'Write architecture decision record',
        status: TaskStatus.IN_PROGRESS,
        estimatedPomodoros: 4,
      },
      {
        projectId: deepWork.id,
        title: 'Review pull requests',
        status: TaskStatus.DONE,
        estimatedPomodoros: 2,
      },
      {
        projectId: studies.id,
        title: 'Read chapter on indexing',
        status: TaskStatus.TODO,
        estimatedPomodoros: 3,
      },
      {
        projectId: studies.id,
        title: 'Practice SQL window functions',
        status: TaskStatus.DONE,
        estimatedPomodoros: 2,
      },
      {
        projectId: sideProject.id,
        title: 'Sketch onboarding flow',
        status: TaskStatus.TODO,
        estimatedPomodoros: 5,
      },
      { projectId: null, title: 'Inbox zero', status: TaskStatus.TODO, estimatedPomodoros: 1 },
    ].map((task) =>
      prisma.task.create({
        data: {
          ...task,
          userId: user.id,
          completedAt: task.status === TaskStatus.DONE ? daysAgo(1, 17) : null,
        },
      }),
    ),
  );

  // Fourteen days of history with a deliberate gap, so streak and daily-average
  // metrics have something non-trivial to compute.
  const sessions = [];
  for (let day = 13; day >= 0; day -= 1) {
    if (day === 9 || day === 10) continue;

    const focusBlocks = (day % 3) + 1;
    for (let block = 0; block < focusBlocks; block += 1) {
      const startedAt = daysAgo(day, 9 + block * 2);
      const durationSec = 1500;
      const abandoned = day % 7 === 0 && block === focusBlocks - 1;

      sessions.push({
        userId: user.id,
        taskId: tasks[(day + block) % tasks.length].id,
        kind: SessionKind.FOCUS,
        status: abandoned ? SessionStatus.CANCELLED : SessionStatus.COMPLETED,
        startedAt,
        durationSec,
        pausedAccumulatedMs: 0,
        endedAt: new Date(startedAt.getTime() + (abandoned ? 400_000 : durationSec * 1000)),
      });

      if (!abandoned) {
        const breakStart = new Date(startedAt.getTime() + durationSec * 1000);
        sessions.push({
          userId: user.id,
          taskId: null,
          kind: SessionKind.SHORT_BREAK,
          status: SessionStatus.COMPLETED,
          startedAt: breakStart,
          durationSec: 300,
          pausedAccumulatedMs: 0,
          endedAt: new Date(breakStart.getTime() + 300_000),
        });
      }
    }
  }

  await prisma.pomodoroSession.createMany({ data: sessions });

  console.log(
    `Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}) with ` +
      `${user.projects.length} projects, ${tasks.length} tasks and ${sessions.length} sessions.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
