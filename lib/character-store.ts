import { db } from "./db";

export const CHARACTER_ROLES = ["mentor", "classmate", "companion"] as const;

export type CharacterRole = (typeof CHARACTER_ROLES)[number];

export interface CharacterCardInput {
  id?: string;
  name: string;
  role: CharacterRole;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  avatar?: string;
  avatarUrl?: string;
  relationshipLine?: string;
  isTeacher?: boolean;
  usageMode?: "classroom" | "private" | "both";
  visibility?: "private" | "public";
}

function initials(name: string) {
  return name.trim().slice(0, 1) || "人";
}

function trimText(value: string | undefined, max = 1200) {
  return (value || "").trim().slice(0, max);
}

function normalizeInput(input: CharacterCardInput, fallbackVisibility: "private" | "public" = "private") {
  const name = input.name.trim().slice(0, 40);
  const visibility = input.visibility === "public" || input.visibility === "private"
    ? input.visibility
    : fallbackVisibility;
  return {
    name,
    role: input.role,
    description: trimText(input.description),
    personality: trimText(input.personality),
    scenario: trimText(input.scenario),
    firstMessage: trimText(input.firstMessage),
    avatar: trimText(input.avatar, 4) || initials(name),
    avatarUrl: input.avatarUrl?.trim() || null,
    relationshipLine: trimText(input.relationshipLine),
    isTeacher: input.isTeacher || input.role === "mentor",
    usageMode: input.usageMode === "classroom" || input.usageMode === "private" ? input.usageMode : "both",
    visibility,
  };
}

export async function listCharacterCards(userId: string) {
  return db.characterCard.findMany({
    where: { userId },
    orderBy: [{ isTeacher: "desc" }, { role: "asc" }, { updatedAt: "desc" }],
  });
}

export async function createCharacterCard(userId: string, input: CharacterCardInput) {
  return db.characterCard.create({
    data: {
      userId,
      ...normalizeInput(input),
    },
  });
}

export async function updateCharacterCard(userId: string, input: CharacterCardInput & { id: string }) {
  const existing = await db.characterCard.findFirst({
    where: { id: input.id, userId },
    select: { id: true, visibility: true },
  });
  if (!existing) return null;

  return db.characterCard.update({
    where: { id: input.id },
    data: normalizeInput(input, existing.visibility === "public" ? "public" : "private"),
  });
}

export async function exportCharacterCard(userId: string, id: string) {
  const card = await db.characterCard.findFirst({ where: { id, userId } });
  if (!card) return null;
  const { userId: _, updatedAt: __, ...exported } = card;
  return exported;
}

export async function exportAllCharacterCards(userId: string) {
  const cards = await db.characterCard.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return cards.map(({ userId: _, updatedAt: __, ...exported }) => exported);
}

export async function importCharacterCards(
  userId: string,
  cards: CharacterCardInput[],
) {
  const created: Array<{ id: string; name: string }> = [];
  for (const card of cards) {
    const result = await createCharacterCard(userId, card);
    created.push({ id: result.id, name: result.name });
  }
  return created;
}

export async function addRelationship(
  sourceCardId: string, targetCardId: string, relationType?: string, description?: string,
) {
  return db.characterRelationship.create({
    data: {
      sourceCardId,
      targetCardId,
      relationType: relationType || "",
      description: description || "",
    },
  });
}

export async function removeRelationship(id: string) {
  try { await db.characterRelationship.delete({ where: { id } }); return true; }
  catch { return false; }
}

export async function listRelationships(cardId: string) {
  return db.characterRelationship.findMany({
    where: { sourceCardId: cardId },
    include: { target: { select: { id: true, name: true, role: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCharacterCard(userId: string, id: string) {
  const existing = await db.characterCard.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return false;

  await db.characterCard.delete({ where: { id } });
  return true;
}
