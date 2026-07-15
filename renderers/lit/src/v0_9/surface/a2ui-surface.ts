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

import {html, nothing, LitElement, PropertyValues} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {
  ComponentNode,
  NodeResolver,
  SurfaceModel,
  effect,
  getValue,
  peekValue,
} from '@a2ui/web_core/v0_9';
import {renderA2uiNode} from './render-a2ui-node.js';
import {LitComponentApi} from '../types.js';

/**
 * A Lit component that renders an A2UI Surface.
 *
 * This component takes a `SurfaceModel`, resolves it through a
 * `NodeResolver`, and renders the resolved component tree. It handles
 * loading states while the root component is not yet available.
 *
 * @element a2ui-surface
 */
@customElement('a2ui-surface')
export class A2uiSurface extends LitElement {
  /**
   * The surface model containing the component tree and catalog.
   */
  @property({type: Object}) accessor surface: SurfaceModel<LitComponentApi> | undefined;

  private resolver?: NodeResolver<LitComponentApi>;
  private stopEffect?: () => void;
  private lastRoot: ComponentNode | undefined;

  /**
   * Handles lifecycle updates, specifically when the `surface` property changes.
   */
  protected override willUpdate(changedProperties: PropertyValues) {
    if (changedProperties.has('surface')) {
      this.teardown();
      this.setup();
    }
  }

  /**
   * Recreates the resolver when the element reconnects after a disconnect.
   */
  override connectedCallback() {
    super.connectedCallback();
    if (this.surface && !this.resolver) {
      this.setup();
    }
  }

  /**
   * Disposes the resolver and its whole node tree.
   */
  override disconnectedCallback() {
    super.disconnectedCallback();
    this.teardown();
  }

  private setup() {
    if (!this.surface) return;
    const resolver = new NodeResolver(this.surface, this.surface.catalog);
    this.resolver = resolver;
    this.lastRoot = peekValue(resolver.rootNode);
    this.stopEffect = effect(() => {
      const root = getValue(resolver.rootNode);
      // The effect runs synchronously at subscription time; the identity
      // check absorbs that first call.
      if (root !== this.lastRoot) {
        this.lastRoot = root;
        this.requestUpdate();
      }
    });
  }

  private teardown() {
    this.stopEffect?.();
    this.stopEffect = undefined;
    this.resolver?.dispose();
    this.resolver = undefined;
    this.lastRoot = undefined;
  }

  /**
   * Renders the surface.
   *
   * If `surface` is not set, returns `nothing`.
   * If the root component is not yet available, renders a loading state.
   * Otherwise, renders the resolved root node.
   */
  override render() {
    if (!this.surface || !this.resolver) return nothing;
    const root = peekValue(this.resolver.rootNode);
    if (!root) {
      return html`<slot name="loading"><div>Loading surface...</div></slot>`;
    }
    return renderA2uiNode(this.surface, root);
  }
}
