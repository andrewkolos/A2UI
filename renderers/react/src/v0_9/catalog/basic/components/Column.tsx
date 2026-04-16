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
import {createComponentImplementation} from '../../../adapter';
import {ColumnApi} from '@a2ui/web_core/v0_9/basic_catalog';
import {ChildList} from './ChildList';
import {mapJustify, mapAlign} from '../utils';

export const Column = createComponentImplementation(ColumnApi, ({props, buildChild, context}) => {
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: mapJustify(props.justify),
    alignItems: mapAlign(props.align),
    width: '100%',
    margin: 0,
    padding: 0,
    minWidth: 0,
  };
  if (typeof (props as { weight?: number }).weight === 'number') {
    const w = (props as { weight?: number }).weight!;
    style.flex = `${w} ${w} 0`;
  }
  return (
    <div style={style}>
      <ChildList childList={props.children} buildChild={buildChild} context={context} />
    </div>
  );
});
