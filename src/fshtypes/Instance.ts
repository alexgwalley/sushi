import { AssignmentRule, InsertRule } from './rules';
import { FshEntity } from './FshEntity';
import { EOL } from 'os';
import { fshifyString } from './common';
import { InstanceUsage } from './InstanceUsage';

export class Instance extends FshEntity {
  id: string;
  title?: string;
  instanceOf: string;
  description?: string;
  usage?: InstanceUsage;
  mixins?: string[];
  rules: (AssignmentRule | InsertRule)[];

  constructor(public name: string) {
    super();
    this.id = name; // init same as name
    this.mixins = [];
    this.rules = [];
    this.usage = 'Example'; // init to Example (default)
  }

  get constructorName() {
    return 'Instance';
  }

  metadataToFSH() {
    const resultLines: string[] = [];
    resultLines.push(`Instance: ${this.name}`);
    resultLines.push(`InstanceOf: ${this.instanceOf}`);
    if (this.title) {
      resultLines.push(`Title: "${fshifyString(this.title)}"`);
    }
    if (this.description) {
      // Description can be a multiline string.
      // If it contains newline characters, treat it as a multiline string.
      if (this.description.indexOf('\n') > -1) {
        resultLines.push(`Description: """${this.description}"""`);
      } else {
        resultLines.push(`Description: "${fshifyString(this.description)}"`);
      }
    }
    if (this.usage) {
      resultLines.push(`Usage: #${this.usage.toLowerCase()}`);
    }
    return resultLines.join(EOL);
  }

  toFSH(): string {
    const metadataFSH = this.metadataToFSH();
    const rulesFSH = this.rules.map(r => r.toFSH()).join(EOL);
    return `${metadataFSH}${rulesFSH.length ? EOL + rulesFSH : ''}`;
  }
}
