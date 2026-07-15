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

import {ReactiveController} from 'lit';
import {
  ComponentApi,
  ComponentNode,
  ResolveA2uiProps,
  InferredComponentApiSchemaType,
  effect,
  getValue,
  peekValue,
  type NodeProps,
} from '@a2ui/web_core/v0_9';
import {A2uiLitElement} from './a2ui-lit-element.js';

/** Child nodes of one element, keyed by componentId and by componentId@dataPath. */
export type ChildIndex = Map<string, ComponentNode>;

function registerChild(index: ChildIndex, child: ComponentNode): void {
  index.set(`${child.componentId}@${child.dataPath}`, child);
  if (!index.has(child.componentId)) {
    index.set(child.componentId, child);
  }
}

/**
 * Converts node-resolved props to the shapes views are written against: a
 * child node becomes its componentId string when it shares the parent's data
 * scope, and an `{id, basePath}` pair when it was spawned at a scoped path
 * (a template item). The nodes themselves are collected into `index` for
 * `renderNode` to find again.
 */
function toViewValue(parent: ComponentNode, value: unknown, index: ChildIndex): unknown {
  if (value instanceof ComponentNode) {
    registerChild(index, value);
    if (value.dataPath !== parent.dataPath) {
      return {id: value.componentId, basePath: value.dataPath};
    }
    return value.componentId;
  }
  if (Array.isArray(value)) {
    return value.map(item => toViewValue(parent, item, index));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      result[key] = toViewValue(parent, inner, index);
    }
    return result;
  }
  return value;
}

/**
 * A Lit ReactiveController exposing an A2UI component's resolved props.
 *
 * The host's {@link ComponentNode} carries the resolved props; this
 * controller subscribes to that node's props signal, converts child
 * references to the view shapes, and requests a host update whenever the
 * node's own resolved properties change.
 *
 * @template Api The specific A2UI component API interface this controller is bound to.
 */
export class A2uiController<Api extends ComponentApi> implements ReactiveController {
  /**
   * The current reactive properties of the A2UI component, matching the expected output schema.
   */
  public props: ResolveA2uiProps<InferredComponentApiSchemaType<Api>>;

  /** The live child nodes referenced by {@link props}, for `renderNode`. */
  readonly childIndex: ChildIndex = new Map();

  private lastResolved: NodeProps;
  private stopEffect?: () => void;

  /**
   * Initializes the controller, binding it to the given Lit element and API schema.
   *
   * @param host The A2uiLitElement acting as the component host.
   * @param _api The A2UI component API defining the schema for this element.
   */
  constructor(
    private host: A2uiLitElement<any>,
    _api: Api,
  ) {
    this.lastResolved = peekValue(this.host.node.props);
    this.props = this.convert(this.lastResolved);
    this.host.addController(this);
    if (this.host.isConnected) {
      this.hostConnected();
    }
  }

  private convert(resolved: NodeProps): ResolveA2uiProps<InferredComponentApiSchemaType<Api>> {
    this.childIndex.clear();
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(resolved)) {
      converted[key] = toViewValue(this.host.node, value, this.childIndex);
    }
    return converted as ResolveA2uiProps<InferredComponentApiSchemaType<Api>>;
  }

  /**
   * Subscribes to the node's props signal when the host connects.
   *
   * Triggers a request update on the host element when new props are received.
   */
  hostConnected() {
    if (!this.stopEffect) {
      const node = this.host.node;
      this.stopEffect = effect(() => {
        const resolved = getValue(node.props);
        // The effect runs synchronously at subscription time; the identity
        // check absorbs that first call (the constructor already converted).
        if (resolved === this.lastResolved) {
          return;
        }
        this.lastResolved = resolved;
        this.props = this.convert(resolved);
        this.host.requestUpdate();
      });
    }
  }

  /**
   * Unsubscribes from the node's props signal when the host disconnects.
   */
  hostDisconnected() {
    this.stopEffect?.();
    this.stopEffect = undefined;
  }

  /**
   * Releases the props subscription.
   */
  dispose() {
    this.hostDisconnected();
  }
}
