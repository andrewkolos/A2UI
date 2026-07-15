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

import React from 'react';
import {render} from '@testing-library/react';
import {SurfaceModel, ComponentModel, Catalog} from '@a2ui/web_core/v0_9';
import {BASIC_FUNCTIONS} from '@a2ui/web_core/v0_9/basic_catalog';
import {A2uiSurface} from '../src/v0_9/A2uiSurface';
import type {ReactComponentImplementation} from '../src/v0_9/adapter';

export interface RenderA2uiOptions {
  initialData?: Record<string, any>;
  /** Additional component implementations needed by the children */
  additionalImpls?: ReactComponentImplementation[];
  /** Pre-instantiated ComponentModels for child components */
  additionalComponents?: ComponentModel[];
  /** Functions to include in the catalog */
  functions?: any[];
}

/**
 * A test utility for rendering one A2UI React component with a real A2UI
 * state lifecycle: the component under test is registered as the surface's
 * root and rendered through {@link A2uiSurface}. Children present in
 * `additionalComponents` render for real; missing children render the
 * surface's `[Loading <id>...]` placeholder, which tests can query by text.
 */
export function renderA2uiComponent(
  impl: ReactComponentImplementation,
  _componentId: string,
  initialProperties: Record<string, any>,
  options: RenderA2uiOptions = {},
) {
  const {
    initialData = {},
    additionalImpls = [],
    additionalComponents = [],
    functions = BASIC_FUNCTIONS,
  } = options;

  // Combine all implementations into the catalog
  const allImpls = [impl, ...additionalImpls];
  const catalog = new Catalog('test-catalog', allImpls, functions);
  const surface = new SurfaceModel<ReactComponentImplementation>('test-surface', catalog);

  // Setup data model
  surface.dataModel.set('/', initialData);

  // The surface resolves from the 'root' id.
  const mainModel = new ComponentModel('root', impl.name, initialProperties);
  surface.componentsModel.addComponent(mainModel);

  // Add any explicitly defined child component models
  for (const childModel of additionalComponents) {
    surface.componentsModel.addComponent(childModel);
  }

  const view = render(<A2uiSurface surface={surface} />);

  return {
    view,
    surface,
    mainModel,
    // Helper to trigger data model updates and wait for re-render
    updateData: async (path: string, value: any) => {
      surface.dataModel.set(path, value);
      // Wait for React to process the useSyncExternalStore update
      await new Promise(resolve => setTimeout(resolve, 0));
    },
  };
}
