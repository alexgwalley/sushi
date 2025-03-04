import { FshEntity, FshCode } from '.';
import { EOL } from 'os';
import { fshifyString } from './common';

/**
 * The Invariant class is used to represent the "constraint" field on ElementDefinition
 * Invariant fields map to their corresponding field on "constraint" except:
 * description -> constraint.human
 * name -> constraint.key
 * @see {@link https://www.hl7.org/fhir/elementdefinition.html}
 */
export class Invariant extends FshEntity {
  description: string;
  expression?: string;
  xpath?: string;
  severity: FshCode;

  constructor(public name: string) {
    super();
  }

  get constructorName() {
    return 'Invariant';
  }

  /**
   * Read only property for id that just returns the name of the invariant
   * This was added so that all types that are returned by FSHTank.fish have an id that can be accessed
   */
  get id() {
    return this.name;
  }

  metadataToFSH(): string {
    const resultLines: string[] = [];
    resultLines.push(`Invariant: ${this.name}`);
    if (this.description) {
      // Description can be a multiline string.
      // If it contains newline characters, treat it as a multiline string.
      if (this.description.indexOf('\n') > -1) {
        resultLines.push(`Description: """${this.description}"""`);
      } else {
        resultLines.push(`Description: "${fshifyString(this.description)}"`);
      }
    }
    if (this.severity) {
      resultLines.push(`Severity: ${this.severity}`);
    }
    if (this.expression) {
      resultLines.push(`Expression: "${fshifyString(this.expression)}"`);
    }
    if (this.xpath) {
      resultLines.push(`XPath: "${fshifyString(this.xpath)}"`);
    }
    return resultLines.join(EOL);
  }

  toFSH(): string {
    return this.metadataToFSH();
  }
}
