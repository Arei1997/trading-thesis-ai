import { Direction, ThesisStatus } from '@prisma/client';
import { db } from '../lib/db';

interface CreateThesisInput {
  userId: string;
  assetName: string;
  direction: Direction;
  thesisText: string;
}

interface UpdateThesisInput {
  assetName?: string;
  direction?: Direction;
  thesisText?: string;
  status?: ThesisStatus;
  alertThreshold?: number;
}

const create = (data: CreateThesisInput) => {
  return db.thesis.create({ data });
};

const getAll = (userId: string) => {
  return db.thesis.findMany({
    where: { status: { not: 'CLOSED' }, userId },
    orderBy: { createdAt: 'desc' },
  });
};

const getById = (id: string) => {
  return db.thesis.findUnique({ where: { id } });
};

const update = (id: string, data: UpdateThesisInput) => {
  return db.thesis.update({ where: { id }, data }).catch(() => null);
};

const softDelete = (id: string) => {
  return db.thesis
    .update({ where: { id }, data: { status: ThesisStatus.CLOSED } })
    .catch(() => null);
};

export const thesisService = { create, getAll, getById, update, softDelete };
