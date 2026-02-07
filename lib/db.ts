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

export async function upsertCardDelay(cardUid: string, delaySec: number) {
  return prisma.cardDelayConfig.upsert({
    where: { cardUid },
    update: { delaySec },
    create: { cardUid, delaySec },
  });
}

export async function deleteCardDelay(cardUid: string) {
  return prisma.cardDelayConfig.deleteMany({ where: { cardUid } });
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

export async function addSystemEvent(eventType: string, description?: string) {
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
