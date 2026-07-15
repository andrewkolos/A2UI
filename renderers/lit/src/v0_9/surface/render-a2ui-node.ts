/*
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {html as plainHtml, nothing} from 'lit';
import {html, unsafeStatic} from 'lit/static-html.js';
import {ComponentContext, ComponentNode, SurfaceModel} from '@a2ui/web_core/v0_9';
import {LitComponentApi} from '../types.js';

/**
 * Renders one resolved {@link ComponentNode} as its catalog Lit element.
 *
 * A placeholder node (its component definition has not arrived yet) renders
 * a loading indicator and is swapped in place by the parent when the
 * definition arrives.
 *
 * This function should be used directly very rarely. Instead, programmers
 * should use the `renderNode` method on the base `A2uiLitElement` class,
 * which resolves child references to nodes automatically.
 */
export function renderA2uiNode(surface: SurfaceModel<LitComponentApi>, node: ComponentNode) {
  if (node.disposed) {
    return nothing;
  }
  if (node.isPlaceholder) {
    return plainHtml`<div>[Loading ${node.componentId}...]</div>`;
  }

  const implementation = surface.catalog.components.get(node.type);
  if (!implementation) {
    console.warn(`Component implementation not found for type: ${node.type}`);
    return nothing;
  }

  // Model events deliver asynchronously, so a render can land between a
  // component's removal and the node's downgrade to a placeholder; the
  // parent re-renders when the event arrives.
  if (!surface.componentsModel.get(node.componentId)) {
    return nothing;
  }

  const context = new ComponentContext(surface, node.componentId, node.dataPath);
  const tag = unsafeStatic(implementation.tagName);
  return html`<${tag} .node=${node} .context=${context}></${tag}>`;
}
