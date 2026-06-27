import { useCallback, useEffect, useState } from 'react';
import { getProjects, addProject, removeProject, updateProject, type Project } from '@lib/storage/projects';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const refresh = useCallback(() => { getProjects().then(setProjects); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const add = useCallback((domain: string, label?: string) => addProject(domain, label).then(refresh), [refresh]);
  const remove = useCallback((id: string) => removeProject(id).then(refresh), [refresh]);
  const update = useCallback((id: string, patch: { domain?: string; label?: string }) => updateProject(id, patch).then(refresh), [refresh]);
  return { projects, refresh, add, remove, update };
}
