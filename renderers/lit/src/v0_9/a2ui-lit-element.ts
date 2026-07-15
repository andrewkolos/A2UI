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

import {LitElement, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {ComponentContext, ComponentApi, ComponentNode, type ComponentId} from '@a2ui/web_core/v0_9';
import {renderA2uiNode} from './surface/render-a2ui-node.js';
import {A2uiController} from './a2ui-controller.js';

/**
 * A reference to a child component to render. Either a string ID, an object
 * pairing an ID with an explicit data context path, or a resolved
 * {@link ComponentNode}.
 */
type A2uiChildRef = ComponentId | {id: ComponentId; basePath: string} | ComponentNode;

/**
 * A base class for A2UI Lit elements that manages the A2uiController lifecycle.
 *
 * This element handles the reactive attachment and detachment of the `A2uiController`
 * whenever the component's `node` changes. Subclasses only need to implement
 * `createController` to provide their specific schema-bound controller, and `render`
 * to define the template based on the controller's reactive props.
 *
 * @template Api The specific A2UI component API defining the schema for this element.
 */
export abstract class A2uiLitElement<Api extends ComponentApi> extends LitElement {
  /** The resolved node this element renders. */
  @property({type: Object}) accessor node!: ComponentNode;
  /** The component's context, for theme access and action dispatch. */
  @property({type: Object}) accessor context!: ComponentContext;
  protected controller!: A2uiController<Api>;

  /**
   * Instantiates the unique controller for this element's specific bound API.
   *
   * Subclasses must implement this method to return an `A2uiController` tied to
   * their specific component `Api` definition.
   *
   * @returns A new instance of `A2uiController` matching the component API.
   */
  protected abstract createController(): A2uiController<Api>;

  /**
   * Helper method to render a child A2UI node.
   *
   * @param childRef The reference to the child component to render: the
   *                 value of a child-reference prop (a string ID, an
   *                 `{id, basePath}` pair, or a `ComponentNode`).
   * @param customPath An explicit data model path the child was bound to.
   *                   If provided, this overrides any path in the `childRef`
   *                   object; falls back to the `childRef`'s `basePath`, or
   *                   the current node's path.
   *
   * @returns A Lit template result containing the rendered child component,
   *          or `nothing` if the reference is empty or was not resolved by
   *          the surface (a property the catalog schema does not declare as
   *          a child reference).
   */
  protected renderNode(childRef?: A2uiChildRef, customPath?: string) {
    if (!childRef) return nothing;
    if (!this.node || !this.context || !this.controller) return nothing;
    const surface = this.context.dataContext.surface;

    if (childRef instanceof ComponentNode) {
      return renderA2uiNode(surface, childRef);
    }

    // Path resolution order: customPath > childRef.basePath > node path
    let componentId: ComponentId;
    let path = customPath;
    if (typeof childRef === 'object') {
      componentId = childRef.id;
      path = path ?? childRef.basePath;
    } else {
      componentId = childRef;
    }

    const index = this.controller?.childIndex;
    const child =
      index?.get(path ? `${componentId}@${path}` : componentId) ??
      index?.get(`${componentId}@${this.node.dataPath}`);
    if (!child) {
      console.warn(
        `Child '${componentId}' was not resolved for '${this.node.componentId}'; ` +
          'is its property declared as a component reference in the catalog schema?',
      );
      return nothing;
    }
    return renderA2uiNode(surface, child);
  }

  /**
   * Reacts to changes in the component's properties.
   *
   * When the `node` property changes or is initialized, this method cleans
   * up any existing controller and invokes `createController()` to bind to
   * the new node.
   */
  override willUpdate(changedProperties: Map<string, any>) {
    super.willUpdate(changedProperties);
    if (changedProperties.has('node') && this.node) {
      if (this.controller) {
        this.removeController(this.controller);
        this.controller.dispose();
      }
      this.controller = this.createController();
    }
  }
}
