import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolPanel from '../entrypoints/sidepanel/components/ToolPanel';

describe('ToolPanel', () => {
  it('不传 action 时正常渲染 logo/title/subtitle/children', () => {
    render(
      <ToolPanel logo="●" title="标题" subtitle="副标题">
        <div>内容</div>
      </ToolPanel>
    );
    expect(screen.getByText('标题')).toBeTruthy();
    expect(screen.getByText('副标题')).toBeTruthy();
    expect(screen.getByText('内容')).toBeTruthy();
  });

  it('传 action 时渲染到 header 区域', () => {
    render(
      <ToolPanel logo="●" title="标题" action={<button type="button">动作</button>}>
        <div>内容</div>
      </ToolPanel>
    );
    expect(screen.getByText('动作')).toBeTruthy();
  });
});
