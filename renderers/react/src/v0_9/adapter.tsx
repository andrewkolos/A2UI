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
import type {ComponentContext} from '@a2ui/web_core/v0_9';
import type {
  ComponentApi,
  InferredComponentApiSchemaType,
  ResolveA2uiProps,
} from '@a2ui/web_core/v0_9';

export interface ReactComponentImplementation extends ComponentApi {
  /**
   * The view function rendered with props the node layer resolved. Absent on
   * binderless implementations, which render through {@link render} instead.
   */
  view?: React.FC<ReactA2uiComponentProps<any>>;
  /**
   * A self-binding renderer: it receives no resolved props and reads
   * everything from `context` itself. Only binderless implementations
   * provide one.
   */
  render?: React.FC<{
    context: ComponentContext;
    buildChild: (id: string, basePath?: string) => React.ReactNode;
  }>;
}

export type ReactA2uiComponentProps<T> = {
  props: T;
  buildChild: (id: string, basePath?: string) => React.ReactNode;
  context: ComponentContext;
};

// --- Component Factories ---

/**
 * Creates a React component implementation from a view function. The view
 * receives fully resolved props from the surface's node resolver.
 */
export function createComponentImplementation<Api extends ComponentApi>(
  api: Api,
  RenderComponent: React.FC<
    ReactA2uiComponentProps<ResolveA2uiProps<InferredComponentApiSchemaType<Api>>>
  >,
): ReactComponentImplementation {
  return {
    name: api.name,
    schema: api.schema,
    view: RenderComponent as React.FC<ReactA2uiComponentProps<any>>,
  };
}

/**
 * Creates a React component implementation that manages its own context bindings (no generic binder).
 */
export function createBinderlessComponentImplementation(
  api: ComponentApi,
  RenderComponent: React.FC<{
    context: ComponentContext;
    buildChild: (id: string, basePath?: string) => React.ReactNode;
  }>,
): ReactComponentImplementation {
  return {
    name: api.name,
    schema: api.schema,
    render: RenderComponent,
  };
}
