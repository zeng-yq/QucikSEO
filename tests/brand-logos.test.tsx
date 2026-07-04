import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GoogleLogo, BingLogo, AhrefsLogo, GoogleTrendsLogo } from '../entrypoints/sidepanel/components/brand-logos';

describe('brand-logos', () => {
  const cases = [
    ['GoogleLogo', GoogleLogo],
    ['BingLogo', BingLogo],
    ['AhrefsLogo', AhrefsLogo],
    ['GoogleTrendsLogo', GoogleTrendsLogo],
  ] as const;

  it.each(cases)('%s 渲染为 <img>,默认 size=16 且 src 非空', (_name, Comp) => {
    const { container } = render(<Comp />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('16');
    expect(img!.getAttribute('height')).toBe('16');
    expect(img!.getAttribute('src')).toBeTruthy();
  });

  it.each(cases)('%s 支持 size prop', (_name, Comp) => {
    const { container } = render(<Comp size={28} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('width')).toBe('28');
    expect(img.getAttribute('height')).toBe('28');
  });
});
