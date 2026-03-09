import { prisma } from './prisma';
import { isMasterCardUid } from './utils';

// ─── Access Credentials (was rfid_cards) ──────────────────────

export async function getCards() {
  return prisma.accessCredential.findMany({
    where: { uid: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCardByUid(uid: string) {
  return prisma.accessCredential.findUnique({ where: { uid } });
}

/**
 * Upsert credential: jika UID belum ada → insert baru, jika sudah ada → skip.
 */
export async function upsertCard(uid: string) {
  return prisma.accessCredential.upsert({
    where: { uid },
    update: {},
    create: {
      uid,
      displayName: 'Unknown User',
      isNamed: false,
    },
  });
}

export async function addCard(uid: string, displayName?: string) {
  return prisma.accessCredential.create({
    data: {
      uid,
      displayName: displayName || 'Unknown User',
      isNamed: !!displayName,
    },
  });
}

export async function updateCardName(uid: string, displayName: string) {
  return prisma.accessCredential.update({
    where: { uid },
    data: {
      displayName,
      isNamed: true,
    },
  });
}

export async function removeCard(uid: string) {
  await prisma.cardDelayConfig.deleteMany({ where: { cardUid: uid } });
  return prisma.accessCredential.delete({ where: { uid } });
}

// ─── Access Logs ──────────────────────────────────────────────

export async function getAccessLogs(limit = 200) {
  return prisma.accessLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Tambah log akses.
 * Untuk RFID: auto-insert UID ke access_credentials jika belum ada.
 * Untuk WEB/TOUCH: uid = null.
 */
export async function addAccessLog(data: {
  uid: string | null;
  accessType: string;
  accessResult: string;
}) {
  if (data.uid && data.accessType === 'RFID' && !isMasterCardUid(data.uid)) {
    await upsertCard(data.uid);
  }

  return prisma.accessLog.create({
    data: {
      uid: data.uid,
      accessType: data.accessType,
      accessResult: data.accessResult,
    },
  });
}

export async function clearAccessLogs() {
  return prisma.accessLog.deleteMany();
}

// ─── Card Delay Configs ───────────────────────────────────────

export async function getCardDelays() {
  return prisma.cardDelayConfig.findMany({
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getCardDelay(cardUid: string) {
  return prisma.cardDelayConfig.findUnique({ where: { cardUid } });
}

export async function upsertCardDelay(cardUid: string, delaySec: number, enabled?: boolean) {
  const data: { delaySec: number; enabled?: boolean } = { delaySec };
  if (enabled !== undefined) data.enabled = enabled;
  return prisma.cardDelayConfig.upsert({
    where: { cardUid },
    update: data,
    create: { cardUid, delaySec, enabled: enabled ?? true },
  });
}

export async function setCardDelayEnabled(cardUid: string, enabled: boolean) {
  return prisma.cardDelayConfig.upsert({
    where: { cardUid },
    update: { enabled },
    create: { cardUid, delaySec: 0, enabled },
  });
}

export async function bulkSetCardDelayEnabled(cardUids: string[], enabled: boolean) {
  const ops = cardUids.map((uid) =>
    prisma.cardDelayConfig.upsert({
      where: { cardUid: uid },
      update: { enabled },
      create: { cardUid: uid, delaySec: 0, enabled },
    })
  );
  return prisma.$transaction(ops);
}

export async function deleteCardDelay(cardUid: string) {
  return prisma.cardDelayConfig.deleteMany({ where: { cardUid } });
}

// ─── Card Delay Schedules (time-based) ────────────────────────

export async function getCardDelaySchedules(cardUid?: string) {
  if (cardUid) {
    return prisma.cardDelaySchedule.findMany({
      where: { cardUid },
      orderBy: { startHour: 'asc' },
    });
  }
  return prisma.cardDelaySchedule.findMany({
    orderBy: [{ cardUid: 'asc' }, { startHour: 'asc' }],
  });
}

export async function upsertCardDelaySchedule(
  cardUid: string,
  startHour: number,
  endHour: number,
  delaySec: number
) {
  return prisma.cardDelaySchedule.upsert({
    where: {
      cardUid_startHour_endHour: { cardUid, startHour, endHour },
    },
    update: { delaySec },
    create: { cardUid, startHour, endHour, delaySec },
  });
}

export async function deleteCardDelaySchedule(cardUid: string, startHour: number, endHour: number) {
  return prisma.cardDelaySchedule.deleteMany({
    where: { cardUid, startHour, endHour },
  });
}

export async function deleteAllCardDelaySchedules(cardUid: string) {
  return prisma.cardDelaySchedule.deleteMany({ where: { cardUid } });
}

export async function bulkUpsertCardDelaySchedule(
  cardUids: string[],
  startHour: number,
  endHour: number,
  delaySec: number
) {
  const ops = cardUids.map((uid) =>
    prisma.cardDelaySchedule.upsert({
      where: { cardUid_startHour_endHour: { cardUid: uid, startHour, endHour } },
      update: { delaySec },
      create: { cardUid: uid, startHour, endHour, delaySec },
    })
  );
  return prisma.$transaction(ops);
}

// ─── System Config ────────────────────────────────────────────

export async function getSystemConfig(key: string): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  return config?.value ?? null;
}

export async function setSystemConfig(key: string, value: string) {
  return prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllSystemConfigs() {
  return prisma.systemConfig.findMany();
}

// ─── System Events ────────────────────────────────────────────

// Throttle cleanup: only delete old events once per hour, not on every insert
let lastCleanupTime = 0;

export async function addSystemEvent(eventType: string, description?: string) {
  const now = Date.now();
  // Clean up events older than 3 days — but at most once per hour
  if (now - lastCleanupTime > 3_600_000) {
    lastCleanupTime = now;
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    prisma.systemEvent.deleteMany({ where: { createdAt: { lt: threeDaysAgo } } }).catch(() => {});
  }

  return prisma.systemEvent.create({
    data: { eventType, description },
  });
}

export async function getSystemEvents(limit = 50) {
  return prisma.systemEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── API Key Validation ───────────────────────────────────────

export function validateApiKey(apiKey: string | null): boolean {
  const expectedKey = process.env.ESP32_API_KEY;
  if (!expectedKey) {
    console.warn('ESP32_API_KEY not set in environment variables');
    return false;
  }
  return apiKey === expectedKey;
}
