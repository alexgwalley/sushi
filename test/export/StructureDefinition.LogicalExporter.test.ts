import path from 'path';
import { StructureDefinitionExporter, Package } from '../../src/export';
import { FSHTank, FSHDocument } from '../../src/import';
import { FHIRDefinitions, loadFromPath } from '../../src/fhirdefs';
import { Logical } from '../../src/fshtypes';
import { loggerSpy } from '../testhelpers/loggerSpy';
import { TestFisher } from '../testhelpers';
import { minimalConfig } from '../utils/minimalConfig';
import {
  AddElementRule,
  CardRule,
  CaretValueRule,
  ContainsRule,
  FlagRule
} from '../../src/fshtypes/rules';

describe('LogicalExporter', () => {
  let defs: FHIRDefinitions;
  let doc: FSHDocument;
  let exporter: StructureDefinitionExporter;

  beforeAll(() => {
    defs = new FHIRDefinitions();
    loadFromPath(path.join(__dirname, '..', 'testhelpers', 'testdefs'), 'r4-definitions', defs);
  });

  beforeEach(() => {
    loggerSpy.reset();
    doc = new FSHDocument('fileName');
    const input = new FSHTank([doc], minimalConfig);
    const pkg = new Package(input.config);
    const fisher = new TestFisher(input, defs, pkg);
    exporter = new StructureDefinitionExporter(input, pkg, fisher);
  });

  it('should output empty results with empty input', () => {
    const exported = exporter.export().logicals;
    expect(exported).toEqual([]);
  });

  it('should export a single logical model', () => {
    const logical = new Logical('Foo');
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
  });

  it('should export multiple logical models', () => {
    const logicalFoo = new Logical('Foo');
    const logicalBar = new Logical('Bar');
    doc.logicals.set(logicalFoo.name, logicalFoo);
    doc.logicals.set(logicalBar.name, logicalBar);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(2);
  });

  it('should still export logical models if one fails', () => {
    const logicalFoo = new Logical('Foo');
    logicalFoo.parent = 'Baz'; // invalid parent cause failure
    const logicalBar = new Logical('Bar');
    doc.logicals.set(logicalFoo.name, logicalFoo);
    doc.logicals.set(logicalBar.name, logicalBar);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].name).toBe('Bar');
  });

  it('should export a single logical model with Base parent when parent not defined', () => {
    const logical = new Logical('Foo');
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Base');
  });

  it('should export a single logical model with Base parent by id', () => {
    const logical = new Logical('Foo');
    logical.parent = 'Base';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Base');
  });

  it('should export a single logical model with Base parent by url', () => {
    const logical = new Logical('Foo');
    logical.parent = 'http://hl7.org/fhir/StructureDefinition/Base';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Base');
  });

  it('should export a single logical model with Element parent by id', () => {
    const logical = new Logical('Foo');
    logical.parent = 'Element';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Element');
  });

  it('should export a single logical model with Element parent by url', () => {
    const logical = new Logical('Foo');
    logical.parent = 'http://hl7.org/fhir/StructureDefinition/Element';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Element');
  });

  it('should export a single logical model with another logical model parent by id', () => {
    const logical = new Logical('Foo');
    logical.parent = 'AlternateIdentification';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe(
      'http://hl7.org/fhir/cda/StructureDefinition/AlternateIdentification'
    );
  });

  it('should export a single logical model with another logical model parent by url', () => {
    const logical = new Logical('Foo');
    logical.parent = 'http://hl7.org/fhir/cda/StructureDefinition/AlternateIdentification';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe(
      'http://hl7.org/fhir/cda/StructureDefinition/AlternateIdentification'
    );
  });

  it('should export a single logical model with a complex-type parent by id', () => {
    const logical = new Logical('Foo');
    logical.parent = 'Address';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Address');
  });

  it('should export a single logical model with a complex-type parent by url', () => {
    const logical = new Logical('Foo');
    logical.parent = 'http://hl7.org/fhir/StructureDefinition/Address';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Address');
  });

  it('should export a single logical model with a resource parent by id', () => {
    const logical = new Logical('Foo');
    logical.parent = 'Appointment';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Appointment');
  });

  it('should export a single logical model with a resource parent by url', () => {
    const logical = new Logical('Foo');
    logical.parent = 'http://hl7.org/fhir/StructureDefinition/Appointment';
    doc.logicals.set(logical.name, logical);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(1);
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Appointment');
  });

  it('should log an error with source information when the parent is invalid', () => {
    const logical = new Logical('BadParent').withFile('BadParent.fsh').withLocation([2, 9, 4, 23]);
    logical.parent = 'actualgroup'; // Profile
    doc.logicals.set(logical.name, logical);
    exporter.export();
    expect(loggerSpy.getLastMessage('error')).toMatch(/File: BadParent\.fsh.*Line: 2 - 4\D*/s);
    expect(loggerSpy.getLastMessage('error')).toMatch(
      /The parent of a logical model must be Element, Base, another logical model, a resource, or a type./s
    );
  });

  it('should log an error with source information when the parent is not found', () => {
    const logical = new Logical('Bogus').withFile('Bogus.fsh').withLocation([2, 9, 4, 23]);
    logical.parent = 'BogusParent';
    doc.logicals.set(logical.name, logical);
    exporter.export();
    expect(loggerSpy.getLastMessage('error')).toMatch(/File: Bogus\.fsh.*Line: 2 - 4\D*/s);
    expect(loggerSpy.getLastMessage('error')).toMatch(/Parent BogusParent not found for Bogus/s);
  });

  it('should export logical models with FSHy parents', () => {
    const logicalFoo = new Logical('Foo');
    const logicalBar = new Logical('Bar');
    logicalBar.parent = 'Foo';
    doc.logicals.set(logicalFoo.name, logicalFoo);
    doc.logicals.set(logicalBar.name, logicalBar);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(2);
    expect(exported[0].name).toBe('Foo');
    expect(exported[1].name).toBe('Bar');
    expect(exported[1].baseDefinition === exported[0].url);
  });

  it('should export logical models with the same FSHy parents', () => {
    const logicalFoo = new Logical('Foo');
    const logicalBar = new Logical('Bar');
    logicalBar.parent = 'Foo';
    const logicalBaz = new Logical('Baz');
    logicalBaz.parent = 'Foo';
    doc.logicals.set(logicalFoo.name, logicalFoo);
    doc.logicals.set(logicalBar.name, logicalBar);
    doc.logicals.set(logicalBaz.name, logicalBaz);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(3);
    expect(exported[0].name).toBe('Foo');
    expect(exported[1].name).toBe('Bar');
    expect(exported[2].name).toBe('Baz');
    expect(exported[1].baseDefinition === exported[0].url);
    expect(exported[2].baseDefinition === exported[0].url);
  });

  it('should export logical models with deep FSHy parents', () => {
    const logicalFoo = new Logical('Foo');
    const logicalBar = new Logical('Bar');
    logicalBar.parent = 'Foo';
    const logicalBaz = new Logical('Baz');
    logicalBaz.parent = 'Bar';
    doc.logicals.set(logicalFoo.name, logicalFoo);
    doc.logicals.set(logicalBar.name, logicalBar);
    doc.logicals.set(logicalBaz.name, logicalBaz);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(3);
    expect(exported[0].name).toBe('Foo');
    expect(exported[1].name).toBe('Bar');
    expect(exported[2].name).toBe('Baz');
    expect(exported[1].baseDefinition === exported[0].url);
    expect(exported[2].baseDefinition === exported[1].url);
  });

  it('should export logical models with out-of-order FSHy parents', () => {
    const logicalFoo = new Logical('Foo');
    logicalFoo.parent = 'Bar';
    const logicalBar = new Logical('Bar');
    logicalBar.parent = 'Baz';
    const logicalBaz = new Logical('Baz');
    doc.logicals.set(logicalFoo.name, logicalFoo);
    doc.logicals.set(logicalBar.name, logicalBar);
    doc.logicals.set(logicalBaz.name, logicalBaz);
    const exported = exporter.export().logicals;
    expect(exported.length).toBe(3);
    expect(exported[0].name).toBe('Baz');
    expect(exported[1].name).toBe('Bar');
    expect(exported[2].name).toBe('Foo');
    expect(exported[1].baseDefinition === exported[0].url);
    expect(exported[2].baseDefinition === exported[1].url);
  });

  it('should include added element having logical model as datatype when parent is Base without regard to definition order - order Foo then Bar', () => {
    const logicalFoo = new Logical('Foo');
    const addElementRuleBars = new AddElementRule('bars');
    addElementRuleBars.min = 0;
    addElementRuleBars.max = '1';
    addElementRuleBars.types = [{ type: 'Bar' }];
    addElementRuleBars.short = 'short of property bars';
    logicalFoo.rules.push(addElementRuleBars);
    doc.logicals.set(logicalFoo.name, logicalFoo);

    const logicalBar = new Logical('Bar');
    const addElementRuleLength = new AddElementRule('length');
    addElementRuleLength.min = 0;
    addElementRuleLength.max = '1';
    addElementRuleLength.types = [{ type: 'Quantity' }];
    addElementRuleLength.short = 'short of property length';
    logicalBar.rules.push(addElementRuleLength);
    const addElementRuleWidth = new AddElementRule('width');
    addElementRuleWidth.min = 0;
    addElementRuleWidth.max = '1';
    addElementRuleWidth.types = [{ type: 'Quantity' }];
    addElementRuleWidth.short = 'short of property width';
    logicalBar.rules.push(addElementRuleWidth);
    doc.logicals.set(logicalBar.name, logicalBar);

    const exported = exporter.export().logicals;
    expect(exported.length).toBe(2);
    expect(exported[0].name).toBe('Foo');
    expect(exported[1].name).toBe('Bar');

    expect(exported[0].elements).toHaveLength(2); // 1 Base element + 1 added "bars" element
    expect(exported[0].elements[1].path).toBe('Foo.bars');
    expect(exported[0].elements[1].base.path).toBe('Foo.bars');
    expect(exported[0].elements[1].type[0].code).toBe(
      'http://hl7.org/fhir/us/minimal/StructureDefinition/Bar'
    );
  });

  it('should include added element having logical model as datatype when parent is Base without regard to definition order - order Bar then Foo', () => {
    const logicalBar = new Logical('Bar');
    const addElementRuleLength = new AddElementRule('length');
    addElementRuleLength.min = 0;
    addElementRuleLength.max = '1';
    addElementRuleLength.types = [{ type: 'Quantity' }];
    addElementRuleLength.short = 'short of property length';
    logicalBar.rules.push(addElementRuleLength);
    const addElementRuleWidth = new AddElementRule('width');
    addElementRuleWidth.min = 0;
    addElementRuleWidth.max = '1';
    addElementRuleWidth.types = [{ type: 'Quantity' }];
    addElementRuleWidth.short = 'short of property width';
    logicalBar.rules.push(addElementRuleWidth);
    doc.logicals.set(logicalBar.name, logicalBar);

    const logicalFoo = new Logical('Foo');
    const addElementRuleBars = new AddElementRule('bars');
    addElementRuleBars.min = 0;
    addElementRuleBars.max = '1';
    addElementRuleBars.types = [{ type: 'Bar' }];
    addElementRuleBars.short = 'short of property bars';
    logicalFoo.rules.push(addElementRuleBars);
    doc.logicals.set(logicalFoo.name, logicalFoo);

    const exported = exporter.export().logicals;
    expect(exported.length).toBe(2);
    expect(exported[0].name).toBe('Bar');
    expect(exported[1].name).toBe('Foo');

    expect(exported[1].elements).toHaveLength(2); // 1 Base element + 1 added "bars" element
    expect(exported[1].elements[1].path).toBe('Foo.bars');
    expect(exported[1].elements[1].base.path).toBe('Foo.bars');
    expect(exported[1].elements[1].type[0].code).toBe(
      'http://hl7.org/fhir/us/minimal/StructureDefinition/Bar'
    );
  });

  it('should include added element having logical model as datatype when parent is Element', () => {
    const logicalFoo = new Logical('Foo');
    const addElementRuleBars = new AddElementRule('bars');
    addElementRuleBars.min = 0;
    addElementRuleBars.max = '1';
    addElementRuleBars.types = [{ type: 'Bar' }];
    addElementRuleBars.short = 'short of property bars';
    logicalFoo.rules.push(addElementRuleBars);
    doc.logicals.set(logicalFoo.name, logicalFoo);

    const logicalBar = new Logical('Bar');
    logicalBar.parent = 'Element';
    const addElementRuleLength = new AddElementRule('length');
    addElementRuleLength.min = 0;
    addElementRuleLength.max = '1';
    addElementRuleLength.types = [{ type: 'Quantity' }];
    addElementRuleLength.short = 'short of property length';
    logicalBar.rules.push(addElementRuleLength);
    const addElementRuleWidth = new AddElementRule('width');
    addElementRuleWidth.min = 0;
    addElementRuleWidth.max = '1';
    addElementRuleWidth.types = [{ type: 'Quantity' }];
    addElementRuleWidth.short = 'short of property width';
    logicalBar.rules.push(addElementRuleWidth);
    doc.logicals.set(logicalBar.name, logicalBar);

    const exported = exporter.export().logicals;
    expect(exported.length).toBe(2);
    expect(exported[0].name).toBe('Foo');
    expect(exported[1].name).toBe('Bar');

    expect(exported[0].elements).toHaveLength(2); // 1 Base element + 1 added "bars" element
    const barsElement = exported[0].findElement('Foo.bars');
    expect(barsElement.path).toBe('Foo.bars');
    expect(barsElement.base.path).toBe('Foo.bars');
    expect(barsElement.type[0].code).toBe('http://hl7.org/fhir/us/minimal/StructureDefinition/Bar');
  });

  it('should include added element having logical model as datatype when parent is another logical model', () => {
    const logicalFoo = new Logical('Foo');
    const addElementRuleBars = new AddElementRule('bars');
    addElementRuleBars.min = 0;
    addElementRuleBars.max = '1';
    addElementRuleBars.types = [{ type: 'Bar' }];
    addElementRuleBars.short = 'short of property bars';
    logicalFoo.rules.push(addElementRuleBars);
    doc.logicals.set(logicalFoo.name, logicalFoo);

    const logicalBar = new Logical('Bar');
    logicalBar.parent = 'AlternateIdentification';
    const addElementRuleLength = new AddElementRule('length');
    addElementRuleLength.min = 0;
    addElementRuleLength.max = '1';
    addElementRuleLength.types = [{ type: 'Quantity' }];
    addElementRuleLength.short = 'short of property length';
    logicalBar.rules.push(addElementRuleLength);
    const addElementRuleWidth = new AddElementRule('width');
    addElementRuleWidth.min = 0;
    addElementRuleWidth.max = '1';
    addElementRuleWidth.types = [{ type: 'Quantity' }];
    addElementRuleWidth.short = 'short of property width';
    logicalBar.rules.push(addElementRuleWidth);
    doc.logicals.set(logicalBar.name, logicalBar);

    const exported = exporter.export().logicals;
    expect(exported.length).toBe(2);
    expect(exported[0].name).toBe('Foo');
    expect(exported[1].name).toBe('Bar');

    expect(exported[0].elements).toHaveLength(2); // 1 Base element + 1 added "bars" element
    const barsElement = exported[0].findElement('Foo.bars');
    expect(barsElement.path).toBe('Foo.bars');
    expect(barsElement.base.path).toBe('Foo.bars');
    expect(barsElement.type[0].code).toBe('http://hl7.org/fhir/us/minimal/StructureDefinition/Bar');
  });

  it('should have correct base and types for each nested logical model', () => {
    const logicalOther = new Logical('Other');
    const addElementRuleThing = new AddElementRule('thing');
    addElementRuleThing.min = 1;
    addElementRuleThing.max = '1';
    addElementRuleThing.types = [{ type: 'boolean' }];
    addElementRuleThing.short = 'Is it a thing?';
    logicalOther.rules.push(addElementRuleThing);
    doc.logicals.set(logicalOther.name, logicalOther);

    const logicalFoo = new Logical('FooFromOther');
    logicalFoo.parent = 'Other';
    const addElementRuleBars = new AddElementRule('bars');
    addElementRuleBars.min = 0;
    addElementRuleBars.max = '*';
    addElementRuleBars.types = [{ type: 'BarFromOther' }];
    addElementRuleBars.short = 'The bars of the foo';
    logicalFoo.rules.push(addElementRuleBars);
    doc.logicals.set(logicalFoo.name, logicalFoo);

    const logicalBar = new Logical('BarFromOther');
    logicalBar.parent = 'Other';
    const addElementRuleHeight = new AddElementRule('height');
    addElementRuleHeight.min = 1;
    addElementRuleHeight.max = '1';
    addElementRuleHeight.types = [{ type: 'Quantity' }];
    addElementRuleHeight.short = 'The height of the bar';
    logicalBar.rules.push(addElementRuleHeight);
    doc.logicals.set(logicalBar.name, logicalBar);

    const exported = exporter.export().logicals;
    expect(exported.length).toBe(3);
    expect(exported[0].name).toBe('Other');
    expect(exported[0].baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Base');
    expect(exported[1].name).toBe('FooFromOther');
    expect(exported[1].baseDefinition).toBe(
      'http://hl7.org/fhir/us/minimal/StructureDefinition/Other'
    );
    expect(exported[2].name).toBe('BarFromOther');
    expect(exported[2].baseDefinition).toBe(
      'http://hl7.org/fhir/us/minimal/StructureDefinition/Other'
    );

    const thingElement = exported[0].findElement('Other.thing');
    expect(thingElement.type[0].code).toBe('boolean');
    const barsElement = exported[1].findElement('FooFromOther.bars');
    expect(barsElement.type[0].code).toBe(
      'http://hl7.org/fhir/us/minimal/StructureDefinition/BarFromOther'
    );
    const heightElement = exported[2].findElement('BarFromOther.height');
    expect(heightElement.type[0].code).toBe('Quantity');
  });

  it('should log an error when an inline extension is used', () => {
    const logical = new Logical('MyModel');
    logical.parent = 'Element';
    const containsRule = new ContainsRule('extension')
      .withFile('MyModel.fsh')
      .withLocation([3, 8, 3, 25]);
    containsRule.items.push({
      name: 'SomeExtension'
    });
    logical.rules.push(containsRule);
    doc.logicals.set(logical.name, logical);
    exporter.export();

    expect(loggerSpy.getLastMessage('error')).toMatch(/File: MyModel\.fsh.*Line: 3\D*/s);
    expect(loggerSpy.getLastMessage('error')).toMatch(
      /Use of 'ContainsRule' is not permitted for 'Logical'/s
    );
  });

  it('should allow constraints on newly added elements and sub-elements', () => {
    const logical = new Logical('ExampleModel');
    logical.id = 'ExampleModel';

    const addElementRule = new AddElementRule('name');
    addElementRule.min = 0;
    addElementRule.max = '*';
    addElementRule.types = [{ type: 'HumanName' }];
    addElementRule.short = "A person's full name";
    logical.rules.push(addElementRule);

    const topLevelCardRule = new CardRule('name');
    topLevelCardRule.min = 1;
    topLevelCardRule.max = '1';
    logical.rules.push(topLevelCardRule);

    const subElementCardRule = new CardRule('name.given');
    subElementCardRule.min = 1;
    subElementCardRule.max = '1';
    logical.rules.push(subElementCardRule);

    doc.logicals.set(logical.name, logical);
    exporter.export();
    const logs = loggerSpy.getAllMessages('error');
    expect(logs).toHaveLength(0);
  });

  it('should allow constraints on root elements', () => {
    const logical = new Logical('ExampleModel');
    logical.id = 'ExampleModel';

    const rootElementRule = new CaretValueRule('.');
    rootElementRule.caretPath = 'alias';
    rootElementRule.value = 'ExampleAlias';

    logical.rules.push(rootElementRule);

    doc.logicals.set(logical.name, logical);
    exporter.export();
    const logs = loggerSpy.getAllMessages('error');
    expect(logs).toHaveLength(0);
  });

  it('should log an error when constraining a parent element', () => {
    const logical = new Logical('MyTestModel');
    logical.parent = 'AlternateIdentification';
    logical.id = 'MyModel';

    const addElementRule1 = new AddElementRule('backboneProp');
    addElementRule1.min = 0;
    addElementRule1.max = '*';
    addElementRule1.types = [{ type: 'BackboneElement' }];
    addElementRule1.short = 'short of backboneProp';
    logical.rules.push(addElementRule1);

    const addElementRule2 = new AddElementRule('backboneProp.name');
    addElementRule2.min = 1;
    addElementRule2.max = '1';
    addElementRule2.types = [{ type: 'HumanName' }];
    addElementRule2.short = 'short of backboneProp.name';
    logical.rules.push(addElementRule2);

    const addElementRule3 = new AddElementRule('backboneProp.address');
    addElementRule3.min = 0;
    addElementRule3.max = '*';
    addElementRule3.types = [{ type: 'Address' }];
    addElementRule3.short = 'short of backboneProp.address';
    logical.rules.push(addElementRule3);

    const flagRule1 = new FlagRule('effectiveTime')
      .withFile('ConstrainParent.fsh')
      .withLocation([6, 1, 6, 16]);
    flagRule1.summary = true;
    logical.rules.push(flagRule1);

    const cardRule1 = new CardRule('effectiveTime')
      .withFile('ConstrainParent.fsh')
      .withLocation([7, 1, 7, 18]);
    cardRule1.min = 1;
    cardRule1.max = '1';
    logical.rules.push(cardRule1);

    const flagRule2 = new FlagRule('backboneProp.address');
    flagRule2.summary = true;
    logical.rules.push(flagRule2);

    const cardRule2 = new CardRule('backboneProp.address');
    cardRule2.min = 1;
    cardRule2.max = '100';
    logical.rules.push(cardRule2);

    doc.logicals.set(logical.name, logical);

    const exported = exporter.export().logicals[0];

    const logs = loggerSpy.getAllMessages('error');
    expect(logs).toHaveLength(2);
    logs.forEach(log => {
      expect(log).toMatch(
        /FHIR prohibits logical models and resources from constraining parent elements. Skipping.*at path 'effectiveTime'.*File: ConstrainParent\.fsh.*Line:\D*/s
      );
    });

    expect(exported.name).toBe('MyTestModel');
    expect(exported.id).toBe('MyModel');
    expect(exported.type).toBe('http://hl7.org/fhir/us/minimal/StructureDefinition/MyModel');
    expect(exported.baseDefinition).toBe(
      'http://hl7.org/fhir/cda/StructureDefinition/AlternateIdentification'
    );
    expect(exported.elements).toHaveLength(9); // 6 AlternateIdentification elements + 3 added elements
  });
});
