import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Bob Smith',
        email: 'bob@example.com',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Charlie Davis',
        email: 'charlie@example.com',
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create incidents
  const incidents = await Promise.all([
    prisma.incident.create({
      data: {
        title: 'Database connection timeout',
        description: 'Production database is experiencing connection timeouts',
        severity: 'P1',
        status: 'OPEN',
        createdBy: users[0].id,
      },
    }),
    prisma.incident.create({
      data: {
        title: 'API response time degradation',
        description: 'API endpoints are responding slower than usual',
        severity: 'P2',
        status: 'ACK',
        createdBy: users[1].id,
      },
    }),
    prisma.incident.create({
      data: {
        title: 'Minor UI bug in dashboard',
        description: 'Dashboard chart tooltips not displaying correctly',
        severity: 'P3',
        status: 'RESOLVED',
        createdBy: users[2].id,
      },
    }),
  ]);

  console.log(`Created ${incidents.length} incidents`);

  // Create events for incidents
  for (const incident of incidents) {
    await prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: 'CREATED',
        payload: {
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
        },
      },
    });

    // Add a status change event for non-OPEN incidents
    if (incident.status !== 'OPEN') {
      await prisma.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: 'STATUS_CHANGED',
          payload: {
            from: 'OPEN',
            to: incident.status,
          },
        },
      });
    }

    // Add a comment to each incident
    await prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: 'COMMENTED',
        payload: {
          comment: 'Initial investigation started',
          userId: incident.createdBy,
        },
      },
    });
  }

  console.log('Seeding completed successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
