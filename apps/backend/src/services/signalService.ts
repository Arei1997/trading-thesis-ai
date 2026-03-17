import { db } from '../lib/db';

const getRecent = (limit = 50) => {
  return db.signal.findMany({
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
};

export const signalService = { getRecent };
