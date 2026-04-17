/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { renderA2uiComponent } from '../utils';
import { Text } from '../../src/v0_9/catalog/basic';
import { MarkdownContext } from '../../src/v0_9/catalog/basic/context/MarkdownContext';

describe('Markdown rendering defaults', () => {
  it('renders markdown by default without an explicit MarkdownContext provider', async () => {
    const { view } = renderA2uiComponent(Text, 't1', { text: 'Hello', variant: 'h1' });

    await waitFor(() => {
      const h1 = view.container.querySelector('h1');
      expect(h1).not.toBeNull();
      expect(h1?.textContent).toBe('Hello');
    });
  });

  it('does not render literal markdown syntax in the fallback', async () => {
    const { view } = renderA2uiComponent(Text, 't1', { text: 'Hello', variant: 'h1' });

    await waitFor(() => {
      expect(view.container.textContent).not.toContain('# Hello');
    });
  });

  it('uses a custom renderer when MarkdownContext is overridden', async () => {
    const customRenderer = vi.fn(async (text: string) => `<p>CUSTOM: ${text}</p>`);

    const { context } = renderA2uiComponent(Text, 't1', { text: 'Hello' });
    const ComponentToRender = Text.render;
    const { container } = render(
      <MarkdownContext.Provider value={customRenderer}>
        <ComponentToRender context={context} buildChild={() => null} />
      </MarkdownContext.Provider>
    );

    await waitFor(() => {
      expect(customRenderer).toHaveBeenCalled();
      expect(container.textContent).toContain('CUSTOM:');
    });
  });
});
