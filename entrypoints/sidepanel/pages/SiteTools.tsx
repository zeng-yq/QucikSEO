import { useState } from 'react';
import Combobox from '../components/Combobox';
import ToolCard from '../components/ToolCard';
import ProjectModal from '../components/ProjectModal';
import SubmitPanel from './SubmitPanel';
import { IconSubmit, IconRobots, IconSitemap } from '../components/icons';
import { useSite } from '../hooks/useSite';
import { useProjects } from '../hooks/useProjects';
import { buildSeoFileUrl, type SeoFile } from '@lib/seo-files/url';
import { isValidDomain } from '@lib/storage/projects';

export default function SiteTools() {
  const { site, setSite } = useSite();
  const { projects } = useProjects();
  const [view, setView] = useState<'list' | 'submit'>('list');
  const [modalOpen, setModalOpen] = useState(false);

  const domains = projects.map((p) => p.domain);
  const hasSite = isValidDomain(site.domain);

  function openSeo(file: SeoFile) {
    if (!hasSite) return;
    try { chrome.tabs.create({ url: buildSeoFileUrl(site.domain, file) }); }
    catch { /* buildSeoFileUrl 校验失败静默（已由 hasSite 拦截） */ }
  }

  if (view === 'submit') return <SubmitPanel site={site} onBack={() => setView('list')} />;

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>网站</label>
      <Combobox value={site.domain} options={domains} placeholder="example.com" onChange={(v) => setSite({ domain: v })} onManage={() => setModalOpen(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-lg)' }}>
        <ToolCard icon={<IconSubmit />} title="网站提交" subtitle="GSC · Bing" onClick={() => setView('submit')} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <ToolCard icon={<IconRobots />} title="robots.txt" onClick={hasSite ? () => openSeo('robots.txt') : undefined} disabled={!hasSite} />
          </div>
          <div style={{ flex: 1 }}>
            <ToolCard icon={<IconSitemap />} title="sitemap.xml" onClick={hasSite ? () => openSeo('sitemap.xml') : undefined} disabled={!hasSite} />
          </div>
        </div>
        {!hasSite && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>请先选择或填写网站以打开 SEO 文件</div>}
      </div>

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
