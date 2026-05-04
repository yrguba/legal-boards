/**
 * Workspace IDs (из `.env`), куда клиент LEXPRO может подать первый запрос до появления
 * записи LexClientWorkspace. Разделители: запятая, точка с запятой или пробел.
 */
export function getLexIntakeWorkspaceIds(): Set<string> {
  const raw = process.env.LEXPRO_INTAKE_WORKSPACE_IDS ?? '';
  return new Set(raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean));
}

export function workspaceAllowsLexIntake(workspaceId: string): boolean {
  return getLexIntakeWorkspaceIds().has(workspaceId);
}
