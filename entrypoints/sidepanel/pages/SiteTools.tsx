import { useState } from 'react';
import Combobox from '../components/Combobox';
import ToolCard from '../components/ToolCard';
import ProjectModal from '../components/ProjectModal';
import SubmitPanel from './SubmitPanel';
import { IconSubmit, IconRobots, IconSitemap } from '../components/icons';
import { useSite } from '../hooks/useSite';
import { useProjects } from '../hooks/useProjects';
import { isValidDomain } from '@lib/storage/projects';
import { SITE_TOOLS } from '@lib/site-tools/tools';

export default function SiteTools() {
  const { site, setSite } = useSite();
  const { projects } = useProjects();
  const [view, setView] = useState<'list' | 'submit'>('list');
  const [modalOpen, setModalOpen] = useState(false);

  const domains = projects.map((p) => p.domain);
  const hasSite = isValidDomain(site.domain);

  function openTool(buildUrl: (domain: string) => string) {
    if (!hasSite) return;
    try { chrome.tabs.create({ url: buildUrl(site.domain) }); }
    catch { /* buildUrl 校验失败静默（已由 hasSite 拦截） */ }
  }

  if (view === 'submit') return <SubmitPanel site={site} onBack={() => setView('list')} />;

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>网站</label>
      <Combobox value={site.domain} options={domains} placeholder="example.com" onChange={(v) => setSite({ domain: v })} onManage={() => setModalOpen(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-lg)' }}>
        <ToolCard icon={<IconSubmit />} title="网站提交" subtitle="GSC · Bing" onClick={() => setView('submit')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SITE_TOOLS.map((t) => {
            const icon = t.icon === 'robots' ? <IconRobots /> : t.icon === 'sitemap' ? <IconSitemap /> : undefined;
            return (
              <ToolCard
                key={t.id}
                icon={icon}
                logo={t.logo}
                title={t.name}
                onClick={hasSite ? () => openTool(t.buildUrl) : undefined}
                disabled={!hasSite}
              />
            );
          })}
        </div>

        {!hasSite && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>请先选择或填写网站以使用工具</div>}
      </div>

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
