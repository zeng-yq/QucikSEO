import ahrefsLogoUrl from '../assets/logos/ahrefs.png';
import googleTrendsLogoUrl from '../assets/logos/google-trends.png';
import googleLogoUrl from '../assets/logos/google.png';
import bingLogoUrl from '../assets/logos/bing.png';

interface LogoProps { size?: number; }

const logoStyle: React.CSSProperties = {
  objectFit: 'contain',
  display: 'inline-block',
  lineHeight: 0,
};

/** Google — 四色 G。 */
export function GoogleLogo({ size = 16 }: LogoProps) {
  return <img src={googleLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Bing — 青绿色 b。 */
export function BingLogo({ size = 16 }: LogoProps) {
  return <img src={bingLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Ahrefs — 橙色 a。 */
export function AhrefsLogo({ size = 16 }: LogoProps) {
  return <img src={ahrefsLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Google Trends — 四色趋势线。 */
export function GoogleTrendsLogo({ size = 16 }: LogoProps) {
  return <img src={googleTrendsLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}
