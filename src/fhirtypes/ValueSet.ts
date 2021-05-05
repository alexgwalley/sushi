import { Meta } from './specialTypes';

import { Extension } from '../fshtypes';
import { Narrative, Resource, Identifier, CodeableConcept, Coding } from './dataTypes';
import { ContactDetail, UsageContext } from './metaDataTypes';
import { cloneDeep } from 'lodash';
import { HasName, HasId } from './mixins';
import { applyMixins } from '../utils/Mixin';

/**
 * Class representing a FHIR R4 ValueSet.
 *
 * @see {@link http://hl7.org/fhir/R4/valueset.html | FHIR ValueSet}
 */

export class ValueSet {
  readonly resourceType = 'ValueSet';
  // id: FHIRId; // provided by HasId mixin
  meta: Meta;
  implicitRules: string;
  language: string;
  text: Narrative;
  contained: Resource[];
  extension: Extension[];
  modifierExtension: Extension[];
  url: string;
  identifier: Identifier[];
  version: string;
  // name: string; // provided by HasName mixin
  title: string;
  status: 'draft' | 'active' | 'retired' | 'unknown' = 'active';
  experimental: boolean;
  date: string;
  publisher: string;
  contact: ContactDetail[];
  description: string;
  useContext: UsageContext[];
  jurisdiction: CodeableConcept[];
  immutable: boolean;
  purpose: string;
  copyright: string;
  compose: ValueSetCompose;
  expansion: ValueSetExpansion;

  /**
   * Get the file name for serializing to disk.
   * @returns {string} the filename
   */
  getFileName(): string {
    return `ValueSet-${this.id}.json`;
  }

  /**
   * Exports the ValueSet to a properly formatted FHIR JSON representation.
   * @returns {any} the FHIR JSON representation of the ValueSet
   */
  toJSON(): any {
    return {
      ...cloneDeep(this)
    };
  }
}

export interface ValueSet extends HasName, HasId {}
applyMixins(ValueSet, [HasName, HasId]);

export type ValueSetCompose = {
  lockedDate?: string;
  inactive?: boolean;
  include: ValueSetComposeIncludeOrExclude[];
  exclude?: ValueSetComposeIncludeOrExclude[];
};

export type ValueSetComposeIncludeOrExclude = {
  system?: string;
  version?: string;
  valueSet?: string[];
  concept?: ValueSetComposeConcept[];
  filter?: ValueSetComposeFilter[];
};

export type ValueSetComposeConcept = {
  code: string;
  display?: string;
  designation?: ValueSetComposeConceptDesignation[];
};

export type ValueSetComposeConceptDesignation = {
  language?: string;
  use?: Coding;
  value: string;
};

export type ValueSetComposeFilter = {
  property: string;
  op: string;
  value: string;
};

export type ValueSetExpansion = {
  parameter: ValueSetExpansionParameter[];
  contains: ValueSetExpansionContains[];
  timestamp: string;
  total?: number;
};

export type ValueSetExpansionContains = ValueSetComposeConcept & {
  system: string;
  version?: string;
  contains?: ValueSetExpansionContains[];
};

export type ValueSetExpansionParameter = {
  name: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueUri?: string;
  valueCode?: string;
  valueDateTime?: string;
};
