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

import {describe, it, expect} from 'vitest';
import {render, screen, act} from '@testing-library/react';
import {createComponentImplementation} from '../../src/v0_9/adapter';
import {A2uiSurface} from '../../src/v0_9/A2uiSurface';
import {ComponentModel, SurfaceModel, Catalog, CommonSchemas} from '@a2ui/web_core/v0_9';
import {z} from 'zod';

describe('adapter', () => {
  it('renders a view with resolved props and its child', () => {
    const TestComponent = createComponentImplementation(
      {
        name: 'TestComp',
        schema: z.object({
          text: CommonSchemas.DynamicString,
          child: CommonSchemas.ComponentId.optional(),
        }),
      },
      ({props, buildChild}) => (
        <div>
          <span>{String(props.text)}</span>
          {props.child ? buildChild(props.child as string) : null}
        </div>
      ),
    );
    const catalog = new Catalog('test', [TestComponent], []);
    const surface = new SurfaceModel<any>('test-surface', catalog);
    surface.componentsModel.addComponent(
      new ComponentModel('root', 'TestComp', {text: 'Hello World', child: 'child1'}),
    );
    surface.componentsModel.addComponent(
      new ComponentModel('child1', 'TestComp', {text: 'Child'}),
    );

    render(<A2uiSurface surface={surface} />);

    expect(screen.getByText('Hello World')).toBeDefined();
    expect(screen.getByText('Child')).toBeDefined();
  });

  it('reacts to data model changes', async () => {
    const TestComponent = createComponentImplementation(
      {name: 'TestComp', schema: z.object({text: CommonSchemas.DynamicString})},
      ({props}) => <div data-testid="msg">{String(props.text)}</div>,
    );
    const catalog = new Catalog('test', [TestComponent], []);
    const surface = new SurfaceModel<any>('test-surface', catalog);
    surface.dataModel.set('/greeting', 'Hello Reactive');
    surface.componentsModel.addComponent(
      new ComponentModel('root', 'TestComp', {text: {path: '/greeting'}}),
    );

    const {getByTestId} = render(<A2uiSurface surface={surface} />);

    expect(getByTestId('msg').textContent).toBe('Hello Reactive');

    await act(async () => {
      surface.dataModel.set('/greeting', 'Updated Greeting');
    });

    expect(getByTestId('msg').textContent).toBe('Updated Greeting');
  });

  it('stops rendering data changes after unmount', async () => {
    let renderCount = 0;
    const TestComponent = createComponentImplementation(
      {name: 'TestComp', schema: z.object({text: CommonSchemas.DynamicString})},
      ({props}) => {
        renderCount++;
        return <div>{String(props.text)}</div>;
      },
    );
    const catalog = new Catalog('test', [TestComponent], []);
    const surface = new SurfaceModel<any>('test-surface', catalog);
    surface.dataModel.set('/greeting', 'initial');
    surface.componentsModel.addComponent(
      new ComponentModel('root', 'TestComp', {text: {path: '/greeting'}}),
    );

    const {unmount} = render(<A2uiSurface surface={surface} />);
    expect(renderCount).toBeGreaterThan(0);

    unmount();
    const countAfterUnmount = renderCount;

    await act(async () => {
      surface.dataModel.set('/greeting', 'after unmount');
    });

    expect(renderCount).toBe(countAfterUnmount);
  });

  it('renders progressively: placeholder first, then the late child, re-rendering the parent once', async () => {
    const ParentApiDef = {
      name: 'TestParent',
      schema: z.object({child: CommonSchemas.ComponentId}),
    };
    const ChildApiDef = {
      name: 'TestChild',
      schema: z.object({text: CommonSchemas.DynamicString}),
    };

    let parentRenderCount = 0;

    const TestParent = createComponentImplementation(ParentApiDef, ({props, buildChild}) => {
      parentRenderCount++;
      return <div data-testid="parent">{props.child && buildChild(props.child)}</div>;
    });

    const TestChild = createComponentImplementation(ChildApiDef, ({props}) => (
      <span data-testid="resolved">{String(props.text)}</span>
    ));

    const testCatalog = new Catalog('test', [TestParent, TestChild], []);
    const surface = new SurfaceModel<any>('test-surface', testCatalog);

    // 1. Initial state: the parent exists, but its child is missing from the surface.
    surface.componentsModel.addComponent(new ComponentModel('root', 'TestParent', {child: 'child1'}));

    const {getByTestId, queryByTestId} = render(<A2uiSurface surface={surface} />);

    expect(getByTestId('parent').textContent).toContain('[Loading child1...]');

    const countBeforeChild = parentRenderCount;

    // 2. Simulate streaming 'updateComponents' adding the missing child.
    await act(async () => {
      surface.componentsModel.addComponent(
        new ComponentModel('child1', 'TestChild', {text: 'Loaded Data'}),
      );
    });

    expect(queryByTestId('resolved')).not.toBeNull();
    expect(getByTestId('resolved').textContent).toBe('Loaded Data');

    // The placeholder upgrade replaces the parent's child reference, which is
    // a change to the parent's own resolved props, so the parent re-renders
    // exactly once. Child-internal changes still do not touch it (covered by
    // the render-isolation tests in node-surface.test.tsx).
    expect(parentRenderCount).toBe(countBeforeChild + 1);
  });
});
