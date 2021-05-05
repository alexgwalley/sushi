import upperFirst from 'lodash/upperFirst';
import cloneDeep from 'lodash/cloneDeep';
import escapeRegExp from 'lodash/escapeRegExp';
import { ElementDefinition, ElementDefinitionType, LooseElementDefJSON } from './ElementDefinition';
import { Meta } from './specialTypes';
import { Identifier, CodeableConcept, Coding, Narrative, Resource, Extension } from './dataTypes';
import { ContactDetail, UsageContext } from './metaDataTypes';
import {
  CannotResolvePathError,
  InvalidElementAccessError,
  MissingSnapshotError,
  InvalidResourceTypeError,
  InvalidTypeAccessError
} from '../errors';
import {
  getArrayIndex,
  setPropertyOnDefinitionInstance,
  isInheritedResource,
  isExtension
} from './common';
import { HasName, HasId } from './mixins';
import { Fishable, Type } from '../utils/Fishable';
import { applyMixins } from '../utils/Mixin';
import { parseFSHPath, assembleFSHPath } from '../utils/PathUtils';
import { InstanceDefinition } from './InstanceDefinition';
import { isUri } from 'valid-url';

/**
 * A class representing a FHIR R4 StructureDefinition.  For the most part, each allowable property in a StructureDefinition
 * is represented via a get/set in this class, and the value is expected to be the FHIR-compliant JSON that would go
 * in the StructureDefinition JSON file (w/ translation for R3).
 *
 * The snapshot and differential, however, do not have their own properties, but rather are represented as an
 * `elements` get/set property, whose value is a list of `ElementDefinition` instances.
 *
 * @see {@link http://hl7.org/fhir/R4/structuredefinition.html|FHIR StructureDefinition}
 */
export class StructureDefinition {
  readonly resourceType = 'StructureDefinition';
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
  status: string;
  experimental: boolean;
  date: string;
  publisher: string;
  contact: ContactDetail[];
  description: string;
  useContext: UsageContext[];
  jurisdiction: CodeableConcept[];
  purpose: string;
  copyright: string;
  keyword: Coding[];
  fhirVersion: string;
  mapping: StructureDefinitionMapping[];
  kind: string;
  abstract: boolean;
  context: StructureDefinitionContext[];
  contextInvariant: string[];
  type: string;
  baseDefinition: string;
  derivation: 'specialization' | 'constraint';

  /**
   * The StructureDefinition's elements.  The returned array should not be pushed to directly.  Instead, use
   * the {@link addElement} or {@link addElements} function
   */
  elements: ElementDefinition[];

  /**
   * A StructureDefinition instance of StructureDefinition itself.  Needed for supporting escape syntax.
   */
  private _sdStructureDefinition: StructureDefinition;

  /**
   * A flag indicating if the StructureDefinition is currently being processed.
   * This allows us to log messages when processing might be affected by circular dependencies.
   */
  public inProgress?: boolean;

  /**
   * Constructs a StructureDefinition with a root element.
   */
  constructor() {
    // Every structure definition needs a root element
    const root = new ElementDefinition('');
    root.structDef = this;
    root.min = 0;
    root.max = '*';
    root.mustSupport = false;
    root.isModifier = false;
    root.isSummary = false;
    this.elements = [root];
  }

  /**
   * Get the file name for serializing to disk.
   * @returns {string} the filename
   */
  getFileName(): string {
    return `StructureDefinition-${this.id}.json`;
  }

  /**
   * Get the Structure Definition for Structure Definition
   * @param {Fishable} fisher - A fishable implementation for finding definitions and metadata
   * @returns {StructureDefinition} the StructureDefinition of StructureDefinition
   */
  getOwnStructureDefinition(fisher: Fishable): StructureDefinition {
    if (this._sdStructureDefinition == null) {
      this._sdStructureDefinition = StructureDefinition.fromJSON(
        fisher.fishForFHIR('StructureDefinition', Type.Resource)
      );
    }
    return this._sdStructureDefinition;
  }

  /**
   * Adds an ElementDefinition to the StructureDefinition's elements, inserting it into the proper location based
   * on its ID.  This should be used rather than pushing directly to the elements array.
   * @param {ElementDefinition} element - the ElementDefinition to add
   */
  addElement(element: ElementDefinition) {
    let i = 0;
    let lastMatchId = '';
    for (; i < this.elements.length; i++) {
      const currentId = this.elements[i].id;
      if (new RegExp(`^${escapeRegExp(currentId)}[.:/]`).test(element.id)) {
        lastMatchId = currentId;
      } else if (
        !new RegExp(`^${escapeRegExp(lastMatchId)}[./:]`).test(currentId) ||
        // If element is not a slice at this level, and the currentId is a slice, break to add children before slices
        (new RegExp(`^${escapeRegExp(lastMatchId)}[.]`).test(element.id) &&
          new RegExp(`^${escapeRegExp(lastMatchId)}[:/]`).test(currentId))
      ) {
        break;
      }
    }
    this.elements.splice(i, 0, element);
  }

  /**
   * Adds an array of ElementDefinitions to the StructureDefinition, inserting each one into the proper location based
   * on its ID.  This should be used rather than pushing directly to the elements array.
   * @param {ElementDefinition[]} elements - the array of ElementDefinitions to add
   */
  addElements(elements: ElementDefinition[] = []) {
    elements.forEach(e => this.addElement(e));
  }

  /**
   * Finds an element by its id.
   * @param {string} id
   * @returns {ElementDefinition} the found element (or undefined if it is not found)
   */
  findElement(id: string): ElementDefinition {
    if (!id) {
      return;
    }
    return this.elements.find(e => e.id === id);
  }

  /**
   * Finds an element by a FSH-compatible path
   * @param {string} path - The FSH path
   * @param {Fishable} fisher - A fishable implementation for finding definitions and metadata
   * @returns {ElementDefinition} - The found element (or undefined if it is not found)
   */
  findElementByPath(path: string, fisher: Fishable): ElementDefinition {
    // If the path already exists, get it and return the match
    // If !path just return the base parent element
    const fullPath = path && path !== '.' ? `${this.type}.${path}` : this.type;
    const match = this.elements.find(e => e.path === fullPath && !e.id.includes(':'));
    if (match != null) {
      return match;
    }

    // Parse the FSH Path into a form we can work with
    const parsedPath = parseFSHPath(path);

    let fhirPathString = this.type;
    let matchingElements = this.elements;
    let newMatchingElements: ElementDefinition[] = [];
    // Iterate over the path, filtering out elements that do not match
    for (const pathPart of parsedPath) {
      // Add the next part to the path, and see if we have matches on it
      fhirPathString += `.${pathPart.base}`;
      newMatchingElements = matchingElements.filter(
        e =>
          e.path.startsWith(`${fhirPathString}.`) ||
          e.path.startsWith(`${fhirPathString}:`) ||
          e.path === fhirPathString
      );

      // TODO: If path is A.B.C, and we unfold B, but C is invalid, the unfolded
      // elements are still on the structDef. We may want to change this to remove the elements
      // upon error
      // Array for tracking newly added unfolded elements
      let unfoldedElements: ElementDefinition[] = [];
      if (newMatchingElements.length === 0 && matchingElements.length === 1) {
        // If there was previously only one match,
        // we want to unfold that match and dig deeper into it
        unfoldedElements = matchingElements[0].unfold(fisher);
        if (unfoldedElements.length > 0) {
          // Only get the children that match our path
          newMatchingElements = unfoldedElements.filter(e => e.path.startsWith(fhirPathString));
        } else if (matchingElements[0].id.endsWith('[x]')) {
          unfoldedElements = matchingElements[0].unfoldChoiceElementTypes(fisher);
          newMatchingElements = unfoldedElements.filter(e => e.path.startsWith(fhirPathString));
        }
      }

      if (newMatchingElements.length === 0) {
        // If we fail to find any matches, try to find the appropriate [x] element
        // from previous matches or from newly unfolded elements
        // Ex: valueString -> value[x]
        const matchingSlice = this.sliceMatchingValueX(fhirPathString, [
          ...matchingElements,
          ...unfoldedElements
        ]);
        if (matchingSlice) {
          newMatchingElements.push(
            matchingSlice,
            ...matchingSlice.children(),
            ...matchingSlice.getSlices()
          );
          fhirPathString = matchingSlice.path;
        }
      }

      if (newMatchingElements.length > 0) {
        // We succeeded in finding some matches, set them and keep going
        matchingElements = newMatchingElements;
      } else {
        // We got to a point where we couldn't find any matches, just return
        return;
      }

      // After getting matches based on the 'base' part, we now filter according to 'brackets'
      if (pathPart.brackets) {
        const sliceElement = this.findMatchingSlice(pathPart, matchingElements, fisher);
        if (sliceElement) {
          matchingElements = [sliceElement, ...sliceElement.children()];
        } else {
          // If we didn't find a matching sliceElement, there must be a reference
          const matchingRefElement = this.findMatchingRef(pathPart, matchingElements);
          if (matchingRefElement) {
            matchingElements = [matchingRefElement, ...matchingRefElement.children()];
          } else {
            // The bracket parts couldn't be resolved to a slice or a ref, so we failed to find an element
            return;
          }
        }
      }

      // If there are no brackets, remove any slices that don't match exactly
      if (!pathPart.brackets) {
        // Get the end of the current fhirPath (e.g. path1.path2.path3 -> path3)
        const pathDepth = fhirPathString.split('.').length - 1;
        const pathEnd = fhirPathString.split('.')[pathDepth];
        matchingElements = matchingElements.filter(e => {
          const idEnd = e.id.split('.')[pathDepth];
          // If matchingElement id ends with pathEnd:, then it is a slice
          // pathPart.brackets is null, so keep nonslices (no ":" in idEnd)
          // and choice slices since valueString is equivalent to value[x]:valueString
          return !idEnd.includes(`${pathEnd}:`) || idEnd === `${pathEnd}:${pathPart.base}`;
        });
      }
    }

    // We could still have child elements that are matching, if so filter them out now
    matchingElements = matchingElements.filter(e => e.path === fhirPathString);
    // If we have one and only one match, return it, else return undefined
    return matchingElements.length === 1 ? matchingElements[0] : undefined;
  }

  /**
   * This function sets an instance property of an SD if possible
   * @param {string} path - The path to the ElementDefinition to assign
   * @param {any} value - The value to assign
   * @param {Fishable} fisher - A fishable implementation for finding definitions and metadata
   */
  setInstancePropertyByPath(path: string, value: any, fisher: Fishable): void {
    if (path.startsWith('snapshot') || path.startsWith('differential')) {
      throw new InvalidElementAccessError(path);
    }
    const parentName = this.type;
    if (path === 'type' && value !== parentName) {
      throw new InvalidTypeAccessError();
    }
    setPropertyOnDefinitionInstance(this, path, value, fisher);
  }

  /**
   * Creates a new element and adds it to the StructureDefinition elements.
   * @param {string} name - the name of the element to create (which will be appended to the element ID)
   * @returns {ElementDefinition} the new ElementDefinition
   */
  newElement(name = '$UNKNOWN'): ElementDefinition {
    const el = this.elements[0].newChildElement(name);
    this.addElement(el);
    return el;
  }

  /**
   * Each ElementDefinition is capable of producing its own differential, based on differences
   * from a stored "original".  This function captures the current state of each element as the
   * "original", so any further changes made would be captured in the generated differentials.
   */
  captureOriginalElements(): void {
    this.elements.forEach(e => e.captureOriginal());
  }

  /**
   * Clears the stored "original" state for each ElementDefnition, resulting in every property
   * being considered new, and reflected in the generated differentials.
   */
  clearOriginalElements(): void {
    this.elements.forEach(e => e.clearOriginal());
  }

  /**
   * Exports the StructureDefinition to a properly formatted FHIR JSON representation.
   * @returns {any} the FHIR JSON representation of the StructureDefinition
   */
  toJSON(snapshot = true): any {
    const j: LooseStructDefJSON = { resourceType: this.resourceType };
    // First handle properties that are just straight translations to JSON
    for (const prop of PROPS) {
      // @ts-ignore
      if (this[prop] !== undefined) {
        // @ts-ignore
        j[prop] = cloneDeep(this[prop]);
      }
      // children of primitive properties are located by an underscore-prefixed property name
      // @ts-ignore
      if (this[`_${prop}`] !== undefined) {
        // @ts-ignore
        j[`_${prop}`] = cloneDeep(this[`_${prop}`]);
      }
    }

    // Now handle snapshot and differential
    if (snapshot) {
      j.snapshot = { element: this.elements.map(e => e.toJSON()) };
    }

    // Populate the differential
    j.differential = { element: [] };
    this.elements.forEach(e => {
      if (e.hasDiff()) {
        const diff = e.calculateDiff().toJSON();
        const isTypeSlicingChoiceDiff =
          diff.id.endsWith('[x]') &&
          Object.keys(diff).length === 3 &&
          diff.id &&
          diff.path &&
          diff.slicing?.discriminator?.length === 1 &&
          diff.slicing.discriminator[0].type === 'type' &&
          diff.slicing.discriminator[0].path === '$this' &&
          diff.slicing.rules === 'open' &&
          (diff.slicing.ordered == null || diff.slicing.ordered === false);

        // choice[x] elements that differ only by the standard type slicing definition don't need to go in the
        // differential, as they are inferred. See: https://blog.fire.ly/2019/09/13/type-slicing-in-fhir-r4/
        if (!isTypeSlicingChoiceDiff) {
          j.differential.element.push(diff);
        }
      }
    });

    // Never have an empty differential. It makes the IG Publisher mad.
    if (j.differential.element.length === 0) {
      j.differential.element.push({
        id: this.elements[0].id,
        path: this.elements[0].path
      });
    }

    // If the StructureDefinition is in progress, we want to persist that in the JSON so that when
    // the Fisher retrieves it from a package and converts to JSON, the inProgress state will be
    // preserved.  But do NOT persist it when it is false.
    // NOTE: This should be safe because StructureDefinitions should never be inProgress by the
    // time we do the final export.
    if (this.inProgress) {
      j.inProgress = true;
    }

    return j;
  }

  /**
   * Constructs a new StructureDefinition representing the passed in JSON.  The JSON that is passed in must be a
   * properly formatted FHIR 3.0.1 StructureDefinition JSON.
   * @param {any} json - the FHIR 3.0.1 JSON representation of a StructureDefinition to construct
   * @param {captureOriginalElements} - indicate if original elements should be captured for purposes of
   *   detecting differentials.  Defaults to true.
   * @returns {StructureDefinition} a new StructureDefinition instance representing the passed in JSON
   */
  static fromJSON(json: LooseStructDefJSON, captureOriginalElements = true): StructureDefinition {
    const sd = new StructureDefinition();
    // First handle properties that are just straight translations from JSON
    for (const prop of PROPS) {
      // @ts-ignore
      if (json[prop] !== undefined) {
        // @ts-ignore
        sd[prop] = cloneDeep(json[prop]);
      }
    }
    // Now handle the snapshots and (for now) just throw away the differential
    sd.elements.length = 0;
    if (json.snapshot && json.snapshot.element) {
      for (const el of json.snapshot.element) {
        const ed = ElementDefinition.fromJSON(el, captureOriginalElements);
        ed.structDef = sd;
        sd.elements.push(ed);
      }
    } else {
      throw new MissingSnapshotError(sd.url);
    }
    // And finally add back the inProgress field if it's there
    if (json.inProgress) {
      sd.inProgress = true;
    }
    return sd;
  }

  /**
   * This function tests if it is possible to assign value to a path, but does not actually assign it
   * @param {string} path - The path to the ElementDefinition to assign
   * @param {any} value - The value to assign; use null to validate just the path when you know the value is valid
   * @param {Fishable} fisher - A fishable implementation for finding definitions and metadata
   * @param {inlineResourceTypes} - Types that will be used to replace Resource elements
   * @throws {CannotResolvePathError} when the path cannot be resolved to an element
   * @throws {InvalidResourceTypeError} when setting resourceType to an invalid value
   * @returns {any} - The object or value to assign
   */
  validateValueAtPath(
    path: string,
    value: any,
    fisher: Fishable,
    inlineResourceTypes: string[] = []
  ): { assignedValue: any; pathParts: PathPart[] } {
    const pathParts = parseFSHPath(path);
    let currentPath = '';
    let previousPath = '';
    let currentElement: ElementDefinition;
    let previousElement: ElementDefinition;
    for (const [i, pathPart] of pathParts.entries()) {
      // Construct the path up to this point
      previousPath = currentPath;
      currentPath += `${currentPath ? '.' : ''}${pathPart.base}`;
      // If we are indexing into an array, the last bracket should be numeric
      const arrayIndex = getArrayIndex(pathPart);
      if (arrayIndex != null) {
        // If it is a number, add all bracket info besides it back to path
        pathPart.brackets.slice(0, -1).forEach(p => (currentPath += `[${p}]`));
      } else {
        // If it is not a number, then add all bracket info back to path
        pathPart.brackets?.forEach(p => (currentPath += `[${p}]`));
      }
      currentElement = this.findElementByPath(currentPath, fisher);
      // Allow for adding extension elements to the instance that are not on the SD
      if (!currentElement && pathPart.base === 'extension') {
        // Get extension element (if currentPath is A.B.extension[C], get A.B.extension)
        const extensionPath = `${previousPath ? `${previousPath}.` : ''}${pathPart.base}`;
        const extensionElement = this.findElementByPath(extensionPath, fisher);
        // Get the extension being referred to
        const extension = fisher.fishForMetadata(pathPart.brackets[0]);
        if (extension && extensionElement) {
          // If the extension exists, add it as a slice to the SD so that we can assign it
          // This function is only called by InstanceExporter on copies of SDs, not those being exported
          if (!extensionElement.slicing) {
            extensionElement.sliceIt('value', 'url');
          }
          // If an extension is referenced by url, we'll want to add the slice with it's id instead
          const sliceName = isUri(pathPart.brackets[0]) ? extension.id : pathPart.brackets[0];
          const slice = extensionElement.addSlice(sliceName);
          if (!slice.type[0].profile) {
            slice.type[0].profile = [];
          }
          slice.type[0].profile.push(extension.url);
          // Search again for the desired element now that the extension is added
          currentElement = this.findElementByPath(currentPath, fisher);
        }
      }

      // If the element is an extension, and we found that extension via some other identifier than the sliceName
      // we want to replace the path to use the sliceName, since we can assume that was the user's intent
      if (
        isExtension(pathPart.base) &&
        pathPart.slices &&
        currentElement?.sliceName &&
        currentElement?.sliceName !== pathPart.slices.join('/')
      ) {
        pathPart.slices = currentElement.sliceName.split('/');
        pathPart.brackets = [...pathPart.slices, ...pathPart.brackets.filter(b => /^\d+$/.test(b))];
      }

      if (
        !currentElement &&
        pathPart.base === 'resourceType' &&
        previousElement?.type?.length === 1
      ) {
        if (isInheritedResource(value, previousElement.type[0].code, fisher)) {
          return { assignedValue: value, pathParts: pathParts };
        } else {
          throw new InvalidResourceTypeError(value, previousElement.type[0].code);
        }
      }

      if (
        !currentElement ||
        currentElement.max === '0' ||
        (arrayIndex != null &&
          currentElement.max !== '*' &&
          (arrayIndex >= parseInt(currentElement.max) || currentElement.max === '1'))
      ) {
        // We throw an error if the currentElement doesn't exist, has been zeroed out,
        // or is being incorrectly accessed as an array
        throw new CannotResolvePathError(path);
      }

      // Determine if base and/or current are arrays. Note that this is not perfect (if base or current max is missing),
      // but in practice, it appears to be sufficient. We could walk the inheritance tree to get the base and current values
      // when they are missing, but this comes at a cost, and as noted above, the current approach works (likely due to
      // how the publisher populates base in snapshots and how previous code processes the current element).
      const baseIsArray =
        currentElement?.base?.max != null &&
        currentElement.base.max !== '0' &&
        currentElement.base.max !== '1';
      const currentIsArray =
        currentElement?.max != null && currentElement.max !== '0' && currentElement.max !== '1';
      // If the base is an array and we don't yet have an index or the currentElement is singular, make this index 0.
      if (baseIsArray && (arrayIndex == null || !currentIsArray)) {
        if (!pathPart.brackets) pathPart.brackets = [];
        pathPart.brackets.push('0');
      }

      // Primitive and only primitives have a lower case first letter
      if (
        currentElement.type?.length === 1 &&
        currentElement.type[0].code.charAt(0) ===
          currentElement.type[0].code.charAt(0).toLowerCase()
      ) {
        pathPart.primitive = true;
      }

      // If we have inlineResourceTypes at this pathPart, we need to validate recursively using that
      // inline resource type, not the original type of the currentElement
      if (
        inlineResourceTypes.length > 0 &&
        inlineResourceTypes[i] &&
        currentElement.type?.length === 1 &&
        isInheritedResource(inlineResourceTypes[i], currentElement.type[0].code, fisher, true)
      ) {
        const inlineResourceJSON = fisher.fishForFHIR(
          inlineResourceTypes[i],
          Type.Resource,
          Type.Profile
        );
        if (inlineResourceJSON) {
          const inlineResourceStructDef = StructureDefinition.fromJSON(inlineResourceJSON);
          const inlinePath = assembleFSHPath(pathParts.slice(i + 1));
          try {
            const validatedInlineResource = inlineResourceStructDef.validateValueAtPath(
              inlinePath,
              value,
              fisher,
              inlineResourceTypes.slice(i + 1)
            );
            return {
              assignedValue: validatedInlineResource.assignedValue,
              pathParts: pathParts.slice(0, i + 1).concat(validatedInlineResource.pathParts)
            };
          } catch (e) {
            // Catch the error from the recursive call so the original path can be logged
            if (e instanceof CannotResolvePathError) {
              throw new CannotResolvePathError(path);
            } else {
              throw e;
            }
          }
        }
      }

      previousElement = currentElement;
    }
    const clone = currentElement.clone();
    let assignedValue;
    // Assigned resources cannot be assigned by pattern[x]/fixed[x], so we must set assignedValue directly
    if (value instanceof InstanceDefinition) {
      assignedValue = clone.checkAssignInlineInstance(value, fisher).toJSON();
    } else {
      // assignValue will throw if it fails, but skip the check if value is null
      if (value != null) {
        // exactly must be true so that we always test assigning with the more strict fixed[x] approach
        clone.assignValue(value, true, fisher);
      }
      // If there is a fixedValue or patternValue, find it and return it
      const key = Object.keys(clone).find(k => k.startsWith('pattern') || k.startsWith('fixed'));
      if (key != null) assignedValue = clone[key as keyof ElementDefinition];
    }

    return { assignedValue, pathParts };
  }

  /**
   * Looks for a matching choice element. If the choice has no existing slice, we slice it and
   * add to the existing StructureDefinition. If the choice has an existing slice, we return that.
   * @param {string} fhirPath - The path in FHIR to match with
   * @param {ElementDefinition[]} elements - The set of elements to search through
   * @returns {ElementDefinition} - The new slice element if found, else undefined
   */
  private sliceMatchingValueX(fhirPath: string, elements: ElementDefinition[]): ElementDefinition {
    let matchingType: ElementDefinitionType;
    const matchingXElements = elements.filter(e => {
      if (e.path.endsWith('[x]')) {
        for (const t of e.type ?? []) {
          if (`${e.path.slice(0, -3)}${upperFirst(t.code)}` === fhirPath) {
            matchingType = t;
            return true;
          }
        }
      }
    });
    if (matchingXElements.length > 0) {
      const sliceName = fhirPath.slice(fhirPath.lastIndexOf('.') + 1);
      const matchingSlice = matchingXElements.find(c => c.sliceName === sliceName);
      // if we have already have a matching slice, we want to return it
      if (matchingSlice) {
        return matchingSlice;
      } else {
        // if we do not have a matching slice, we want to slice the first match
        const matchingXElement = matchingXElements[0];
        // If we find a matching [x] element, we need to slice it to create the child element
        // NOTE: The spec is somewhat inconsistent on handling choice slicing, we decided on this
        // approach per consistency with 4.0.1 observation-vitalsigns profiles and per this post
        // https://blog.fire.ly/2019/09/13/type-slicing-in-fhir-r4/.
        matchingXElement.sliceIt(
          'type',
          '$this',
          matchingXElement.slicing?.ordered,
          matchingXElement.slicing?.rules
        );
        // Get the sliceName for the new element
        const newSlice = matchingXElement.addSlice(sliceName, matchingType);
        return newSlice;
      }
    }
    return;
  }

  /**
   * Looks for a slice within the set of elements that matches the fhirPath
   * @param {PathPart} pathPart - The path to match sliceName against
   * @param {ElementDefinition[]} elements - The set of elements to search through
   * @returns {ElementDefinition} - The sliceElement if found, else undefined
   */
  private findMatchingSlice(
    pathPart: PathPart,
    elements: ElementDefinition[],
    fisher: Fishable
  ): ElementDefinition {
    let matchingSlice: ElementDefinition;
    matchingSlice = elements.find(e => e.sliceName === pathPart.brackets.join('/'));
    if (!matchingSlice && pathPart.brackets?.length === 1) {
      // If the current element is a child of a slice, the match may exist on the original
      // sliced element, search for that here
      for (const e of elements) {
        const connectedSliceElement = e.findConnectedSliceElement();
        const matchingConnectedSlice = connectedSliceElement
          ?.getSlices()
          .find(e => e.sliceName === pathPart.brackets.join('/'));

        if (matchingConnectedSlice) {
          const newSlice = matchingConnectedSlice.clone(false);
          newSlice.id = `${e.id}:${matchingConnectedSlice.sliceName}`;
          newSlice.structDef = this;
          if (!e.slicing) e.slicing = connectedSliceElement.slicing;
          this.addElement(newSlice);
          return newSlice;
        }
      }

      // If we don't find a match, search predefined extensions for a match
      const sliceDefinition = fisher.fishForFHIR(pathPart.brackets[0], Type.Extension);
      if (sliceDefinition?.url) {
        matchingSlice = elements.find(e => e.type?.[0].profile?.[0] === sliceDefinition.url);
      }
    }
    // NOTE: This function will assume the 'brackets' field contains information about slices. Even
    // if you search for foo[sliceName][refName], this will try to find a re-slice
    // sliceName/refName. To find the matching element for foo[sliceName][refName], you must
    // use the findMatchingRef function. Be aware of this ambiguity in the bracket path syntax.
    return matchingSlice;
  }

  findObsoleteChoices(baseElement: ElementDefinition, oldTypes: ElementDefinitionType[]): string[] {
    // first, find all the elements representing choices for the same choice element
    const parentId = baseElement.parent().id;
    const choiceElements = this.elements.filter(e => {
      return e.path === baseElement.path && e.id.startsWith(parentId);
    });
    const matchedThings: ElementDefinition[] = [];
    const desiredSliceName = baseElement.path
      .slice(baseElement.path.lastIndexOf('.') + 1)
      .slice(0, -3);
    // an obsolete choice is one where:
    // 1. the choice represents a type being constrained out, and
    // 2. a rule has been applied to that choice
    oldTypes.forEach(oldType => {
      matchedThings.push(
        ...choiceElements.filter(e => {
          return e.sliceName == `${desiredSliceName}${upperFirst(oldType.code)}` && e.hasDiff();
        })
      );
    });
    return matchedThings.map(e => e.sliceName);
  }

  /**
   * Looks for a Reference type element within the set of elements that matches the fhirPath
   * @param {PathPart} pathPart - The path to match the Reference type elements against
   * @param {ElementDefinition[]} elements - The set of elements to search through
   * @returns {ElementDefinition} - The Reference type element if found, else undefined
   */
  private findMatchingRef(pathPart: PathPart, elements: ElementDefinition[]): ElementDefinition {
    const matchingRefElement = elements.find(e => {
      // If we have foo[a][b][c], and c is the ref, we need to find an element with sliceName = a/b
      if (
        pathPart.brackets.length === 1 ||
        e.sliceName === pathPart.brackets.slice(0, -1).join('/')
      ) {
        for (const t of e.type ?? []) {
          return (
            t.code === 'Reference' &&
            t.targetProfile &&
            t.targetProfile.find(tp => {
              const refName = pathPart.brackets.slice(-1)[0];
              // Slice to get last part of url
              // http://hl7.org/fhir/us/core/StructureDefinition/profile|3.0.0 -> profile|3.0.0
              let tpRefName = tp.split('/').slice(-1)[0];
              // Slice to get rid of version, profile|3.0.0 -> profile
              tpRefName = tpRefName.split('|')[0];
              return tpRefName === refName;
            })
          );
        }
      }
    });
    return matchingRefElement;
  }

  /**
   * Gets the specific reference being referred to by a path with brackets
   * @param {string} path - The path
   * @param {ElementDefinition} element - The element that may contain the reference
   * @returns {string} - The name of the reference if it exists, else undefined
   */
  getReferenceName(path: string, element: ElementDefinition): string {
    const parsedPath = parseFSHPath(path);
    const pathEnd = parsedPath.slice(-1)[0];
    if (pathEnd.brackets) {
      const refElement = this.findMatchingRef(pathEnd, [element]);
      if (refElement) {
        return pathEnd.brackets.slice(-1)[0];
      }
    }
    return;
  }
}

export interface StructureDefinition extends HasName, HasId {}
applyMixins(StructureDefinition, [HasName, HasId]);

export type StructureDefinitionMapping = {
  identity: string;
  uri?: string;
  name?: string;
  comment?: string;
};

export type StructureDefinitionContext = {
  type: string;
  expression: string;
};

export type PathPart = {
  base: string;
  brackets?: string[];
  primitive?: boolean;
  slices?: string[];
  prefix?: string;
};

/**
 * A barebones and lenient definition of StructureDefinition JSON
 */
interface LooseStructDefJSON {
  resourceType: string;
  derivation?: string;
  snapshot?: { element: LooseElementDefJSON[] };
  differential?: { element: LooseElementDefJSON[] };
  inProgress?: boolean;
  // [key: string]: any;
}

/**
 * The list of StructureDefinition properties used when importing/exporting FHIR JSON.
 */
const PROPS = [
  'id',
  'meta',
  'implicitRules',
  'language',
  'text',
  'contained',
  'extension',
  'modifierExtension',
  'url',
  'identifier',
  'version',
  'name',
  'title',
  'status',
  'experimental',
  'date',
  'publisher',
  'contact',
  'description',
  'useContext',
  'jurisdiction',
  'purpose',
  'copyright',
  'keyword',
  'fhirVersion',
  'mapping',
  'kind',
  'abstract',
  'context',
  'contextInvariant',
  'type',
  'baseDefinition',
  'derivation'
];
