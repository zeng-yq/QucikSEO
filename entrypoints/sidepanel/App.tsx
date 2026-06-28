// entrypoints/sidepanel/App.tsx
import { useState } from 'react';
import Header from './components/Header';
import TabBar, { type Tab } from './components/TabBar';
import SiteTools from './pages/SiteTools';
import KeywordTools from './pages/KeywordTools';

export default function App() {
  const [tab, setTab] = useState<Tab>('site');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <TabBar tab={tab} onChange={setTab} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {tab === 'site' ? <SiteTools /> : <KeywordTools />}
      </main>
    </div>
  );
}
