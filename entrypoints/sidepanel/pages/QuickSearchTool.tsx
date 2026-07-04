import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { GoogleLogo, BingLogo } from '../components/brand-logos';
import { buildGoogleSearchUrl, buildBingSearchUrl } from '@lib/quicksearch/url';
import { GEO_REGIONS, GEO_OFF, getGeoPref, setGeoPref, type GeoCode } from '@lib/quicksearch/geo';

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };

interface Props { keyword: string; }

export default function QuickSearchTool({ keyword }: Props) {
  const disabled = !keyword.trim();
  const [geoCode, setGeoCode] = useState<GeoCode>('US');

  useEffect(() => {
    void (async () => setGeoCode((await getGeoPref()).code))();
  }, []);

  function onGeoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as GeoCode;
    setGeoCode(v);
    void setGeoPref(v); // background 监听 storage 变化，实时增删规则
  }

  const geoOptions = [
    { value: GEO_OFF, label: '🚪 关闭（用真实位置）' },
    ...GEO_REGIONS.map((r) => ({ value: r.code, label: `${r.flag} ${r.label}` })),
  ];

  return (
    <ToolPanel logo={<GoogleLogo size={18} />} title="快捷搜索">
      <label style={labelStyle}>搜索位置</label>
      <div style={{ marginBottom: 8 }}>
        <Select value={geoCode} options={geoOptions} onChange={onGeoChange} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildGoogleSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <GoogleLogo size={14} /> 用 Google 搜
          </span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildBingSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <BingLogo size={14} /> 用 Bing 搜
          </span>
        </Button>
      </div>
    </ToolPanel>
  );
}
