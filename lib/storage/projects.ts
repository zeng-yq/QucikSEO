export interface Project { id: string; domain: string; label?: string; createdAt: number; }
const KEY = 'projects';
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

export function isValidDomain(d: string): boolean { return DOMAIN_RE.test(d.trim()); }

export async function getProjects(): Promise<Project[]> {
  const items = await chrome.storage.local.get(KEY);
  return (items[KEY] as Project[] | undefined) ?? [];
}

async function save(list: Project[]) { await chrome.storage.local.set({ [KEY]: list }); }

// 跨视图同步：依赖 chrome.storage.onChanged（storage.local.set 自动触发），
// useProjects 监听 'projects' key 变化自动 refresh，无需此处手动广播。

export async function addProject(domain: string, label?: string): Promise<Project> {
  const d = domain.trim();
  if (!isValidDomain(d)) throw new Error('invalid domain');
  const project: Project = { id: crypto.randomUUID(), domain: d, label: label?.trim() || undefined, createdAt: Date.now() };
  const list = await getProjects();
  list.push(project);
  await save(list);
  return project;
}

export async function updateProject(id: string, patch: Partial<Pick<Project, 'domain' | 'label'>>): Promise<void> {
  // 与 addProject 一致：先 trim domain 再校验/合并，避免前后空格导致重复或校验绕过。
  const trimmedPatch: typeof patch = { ...patch };
  if (patch.domain != null) {
    const d = patch.domain.trim();
    if (!isValidDomain(d)) throw new Error('invalid domain');
    trimmedPatch.domain = d;
  }
  const list = await getProjects();
  const i = list.findIndex((p) => p.id === id);
  if (i === -1) throw new Error('project not found');
  list[i] = { ...list[i], ...trimmedPatch };
  await save(list);
}

export async function removeProject(id: string): Promise<void> {
  const list = await getProjects();
  await save(list.filter((p) => p.id !== id));
}

/** 按 id 查询单个项目。供 background 取 domain 拼 GSC URL。 */
export async function getProjectById(id: string): Promise<Project | undefined> {
  return (await getProjects()).find((p) => p.id === id);
}
