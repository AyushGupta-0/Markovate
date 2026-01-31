import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { validateStatusTransition } from '../utils/statusTransition';
import { invalidateCache, getCachedData, setCachedData, generateCacheKey } from '../utils/cache';
import { EventType, IncidentStatus, Severity } from '../types';

interface CreateIncidentDTO {
  title: string;
  description: string;
  severity: Severity;
  createdBy: string;
}

interface ListIncidentsParams {
  status?: IncidentStatus;
  severity?: Severity;
  created_from?: Date;
  created_to?: Date;
  page: number;
  limit: number;
}

export async function createIncident(data: CreateIncidentDTO) {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: data.createdBy },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Create incident and event in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        title: data.title,
        description: data.description,
        severity: data.severity,
        createdBy: data.createdBy,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: EventType.CREATED,
        payload: {
          title: data.title,
          description: data.description,
          severity: data.severity,
          createdBy: data.createdBy,
        },
      },
    });

    return incident;
  });

  return result;
}

export async function getIncidentById(id: string) {
  const cacheKey = generateCacheKey('incident', id);
  
  // Try to get from cache
  const cached = await getCachedData(cacheKey);
  if (cached) {
    return cached;
  }

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      events: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      },
    },
  });

  if (!incident) {
    throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  }

  // Cache the result
  await setCachedData(cacheKey, incident);

  return incident;
}

export async function listIncidents(params: ListIncidentsParams) {
  const { status, severity, created_from, created_to, page, limit } = params;

  const where: any = {};
  
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (created_from || created_to) {
    where.createdAt = {};
    if (created_from) where.createdAt.gte = created_from;
    if (created_to) where.createdAt.lte = created_to;
  }

  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    data: incidents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateIncidentStatus(id: string, newStatus: IncidentStatus) {
  const incident = await prisma.incident.findUnique({
    where: { id },
  });

  if (!incident) {
    throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  }

  // Validate status transition
  validateStatusTransition(incident.status as IncidentStatus, newStatus);

  // If same status, return current incident (idempotent)
  if (incident.status === newStatus) {
    return incident;
  }

  // Update status and create event in transaction
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id },
      data: { status: newStatus },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: id,
        type: EventType.STATUS_CHANGED,
        payload: {
          from: incident.status,
          to: newStatus,
        },
      },
    });

    return updated;
  });

  // Invalidate cache
  await invalidateCache(`incident:${id}*`);

  return result;
}

export async function addComment(id: string, comment: string, userId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id },
  });

  if (!incident) {
    throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  }

  const event = await prisma.incidentEvent.create({
    data: {
      incidentId: id,
      type: EventType.COMMENTED,
      payload: {
        comment,
        userId,
      },
    },
  });

  // Invalidate cache
  await invalidateCache(`incident:${id}*`);

  return event;
}
