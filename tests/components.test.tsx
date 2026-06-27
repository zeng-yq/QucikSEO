import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../entrypoints/sidepanel/components/Button';
import Card from '../entrypoints/sidepanel/components/Card';

describe('Button', () => {
  it('渲染子节点并响应点击', () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>开始</Button>);
    fireEvent.click(screen.getByText('开始'));
    expect(clicked).toBe(true);
  });
});

describe('Card', () => {
  it('点击触发 onClick', () => {
    let n = 0;
    render(<Card title="GSC" onClick={() => (n++)} />);
    fireEvent.click(screen.getByText('GSC'));
    expect(n).toBe(1);
  });
});
