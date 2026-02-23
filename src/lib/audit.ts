import { AdminActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LogAdminActionInput = {
  action: AdminActionType;
  actorId: string;
  targetUserId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logAdminAction(input: LogAdminActionInput) {
  await prisma.adminActionLog.create({
    data: {
      action: input.action,
      actor: { connect: { id: input.actorId } },
      targetUser: input.targetUserId ? { connect: { id: input.targetUserId } } : undefined,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
