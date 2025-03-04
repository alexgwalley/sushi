import { TestFisher, loggerSpy } from '../testhelpers';
import { loadFromPath } from '../../src/fhirdefs/load';
import { FHIRDefinitions } from '../../src/fhirdefs/FHIRDefinitions';
import { StructureDefinition } from '../../src/fhirtypes/StructureDefinition';
import { ElementDefinitionType } from '../../src/fhirtypes';
import { Type } from '../../src/utils';
import { OnlyRule } from '../../src/fshtypes/rules';
import { readFileSync } from 'fs-extra';
import { Package, StructureDefinitionExporter } from '../../src/export';
import { minimalConfig } from '../utils/minimalConfig';
import { Profile } from '../../src/fshtypes';
import { FSHTank } from '../../src/import';
import cloneDeep from 'lodash/cloneDeep';
import path from 'path';

describe('ElementDefinition', () => {
  let defs: FHIRDefinitions;
  let observation: StructureDefinition;
  let planDefinition: StructureDefinition;
  let extension: StructureDefinition;
  let fisher: TestFisher;
  let exporter: StructureDefinitionExporter;
  let pkg: Package;

  beforeAll(() => {
    defs = new FHIRDefinitions();
    loadFromPath(path.join(__dirname, '..', 'testhelpers', 'testdefs'), 'r4-definitions', defs);
    pkg = new Package(minimalConfig);
    fisher = new TestFisher().withFHIR(defs).withPackage(pkg);
    exporter = new StructureDefinitionExporter(new FSHTank([], minimalConfig), pkg, fisher);
  });

  beforeEach(() => {
    loggerSpy.reset();
    observation = fisher.fishForStructureDefinition('Observation');
    planDefinition = fisher.fishForStructureDefinition('PlanDefinition');
    extension = fisher.fishForStructureDefinition('Extension');
  });

  describe('#constrainType()', () => {
    it('should allow a choice to be constrained to a subset', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'Quantity' }, { type: 'integer' }];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(2);
      expect(valueX.type[0]).toEqual(new ElementDefinitionType('Quantity'));
      expect(valueX.type[1]).toEqual(new ElementDefinitionType('integer'));
    });

    it('should maintain original type order when constraining to a subset', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [
        { type: 'Period' },
        { type: 'integer' },
        { type: 'Quantity' },
        { type: 'Ratio' }
      ];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(4);
      expect(valueX.type[0]).toEqual(new ElementDefinitionType('Quantity'));
      expect(valueX.type[1]).toEqual(new ElementDefinitionType('integer'));
      expect(valueX.type[2]).toEqual(new ElementDefinitionType('Ratio'));
      expect(valueX.type[3]).toEqual(new ElementDefinitionType('Period'));
    });

    it('should allow a choice to be constrained to a single item', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'Quantity' }];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(1);
      expect(valueX.type[0]).toEqual(new ElementDefinitionType('Quantity'));
    });

    it('should allow a choice to be constrained to a single item by its URL', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'http://hl7.org/fhir/StructureDefinition/Quantity' }];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(1);
      expect(valueX.type[0]).toEqual(new ElementDefinitionType('Quantity'));
    });

    it('should allow a choice to be constrained to a single profile', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'SimpleQuantity' }];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(1);
      expect(valueX.type[0]).toEqual(
        new ElementDefinitionType('Quantity').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/SimpleQuantity'
        )
      );
    });

    it('should allow a choice to be constrained to a profile of Reference', () => {
      const def = JSON.parse(
        readFileSync(
          path.join(
            __dirname,
            '..',
            'testhelpers',
            'testdefs',
            'StructureDefinition-reference-with-type.json'
          ),
          'utf-8'
        ).trim()
      );
      defs.add(def);
      const valueX = extension.elements.find(e => e.id === 'Extension.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'ReferenceWithType' }];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(1);
      expect(valueX.type[0]).toEqual(
        new ElementDefinitionType('Reference').withProfiles(
          'http://example.org/StructureDefinition/reference-with-type'
        )
      );
    });

    it('should allow a resource type to be constrained to multiple profiles', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'SimpleQuantity' }, { type: 'MoneyQuantity' }];
      valueX.constrainType(valueConstraint, fisher);
      expect(valueX.type).toHaveLength(1);
      expect(valueX.type[0]).toEqual(
        new ElementDefinitionType('Quantity').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/SimpleQuantity',
          'http://hl7.org/fhir/StructureDefinition/MoneyQuantity'
        )
      );
    });

    it('should allow Resource to be constrained to a resource', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      const resourceConstraint = new OnlyRule('entry.resource');
      resourceConstraint.types = [{ type: 'Patient' }];
      entryResource.constrainType(resourceConstraint, fisher);
      expect(entryResource.type).toHaveLength(1);
      expect(entryResource.type[0]).toEqual(new ElementDefinitionType('Patient'));
    });

    it('should allow Resource to be constrained to a profile', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      const resourceConstraint = new OnlyRule('entry.resource');
      resourceConstraint.types = [{ type: 'http://hl7.org/fhir/StructureDefinition/bp' }];
      entryResource.constrainType(resourceConstraint, fisher);
      expect(entryResource.type).toHaveLength(1);
      expect(entryResource.type[0]).toEqual(
        new ElementDefinitionType('Observation').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/bp'
        )
      );
    });

    it('should allow a profile to be constrained to a more specific profile', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      entryResource.type[0] = new ElementDefinitionType('Observation').withProfiles(
        'http://hl7.org/fhir/StructureDefinition/bp'
      );

      const profile = new Profile('Foo');
      profile.parent = 'http://hl7.org/fhir/StructureDefinition/bp';
      exporter.exportStructDef(profile);

      const profileConstraint = new OnlyRule('entry.resource');
      profileConstraint.types = [{ type: 'Foo' }];
      entryResource.constrainType(profileConstraint, fisher);
      expect(entryResource.type).toHaveLength(1);
      expect(entryResource.type[0]).toEqual(
        new ElementDefinitionType('Observation').withProfiles(
          'http://hl7.org/fhir/us/minimal/StructureDefinition/Foo'
        )
      );
    });

    it('should allow a profile to be constrained to a more specific profile of a child type', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      entryResource.type[0] = new ElementDefinitionType('Resource').withProfiles(
        'http://hl7.org/fhir/StructureDefinition/bp'
      );

      const profile = new Profile('Foo');
      profile.parent = 'http://hl7.org/fhir/StructureDefinition/bp';
      exporter.exportStructDef(profile);

      const profileConstraint = new OnlyRule('entry.resource');
      profileConstraint.types = [{ type: 'Foo' }];
      entryResource.constrainType(profileConstraint, fisher);
      expect(entryResource.type).toHaveLength(1);
      expect(entryResource.type[0]).toEqual(
        new ElementDefinitionType('Observation').withProfiles(
          'http://hl7.org/fhir/us/minimal/StructureDefinition/Foo'
        )
      );
    });

    it('should allow Resource to be constrained to multiple resources and profiles', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      const resourceConstraint = new OnlyRule('entry.resource');
      resourceConstraint.types = [
        { type: 'Practitioner' },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight' },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyweight' },
        { type: 'http://hl7.org/fhir/StructureDefinition/familymemberhistory-genetic' },
        { type: 'http://hl7.org/fhir/StructureDefinition/Procedure' }
      ];
      entryResource.constrainType(resourceConstraint, fisher);
      expect(entryResource.type).toHaveLength(4);
      expect(entryResource.type[0]).toEqual(new ElementDefinitionType('Practitioner'));
      expect(entryResource.type[1]).toEqual(
        new ElementDefinitionType('Observation').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/bodyheight',
          'http://hl7.org/fhir/StructureDefinition/bodyweight'
        )
      );
      expect(entryResource.type[2]).toEqual(
        new ElementDefinitionType('FamilyMemberHistory').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/familymemberhistory-genetic'
        )
      );
      expect(entryResource.type[3]).toEqual(new ElementDefinitionType('Procedure'));
    });

    it('should allow a choice to be constrained such that only the target type is constrained to a profile and others remain as-is', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'SimpleQuantity' }];
      valueX.constrainType(valueConstraint, fisher, 'Quantity');
      expect(valueX.type).toHaveLength(11);
      expect(valueX.type[0]).toEqual(
        new ElementDefinitionType('Quantity').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/SimpleQuantity'
        )
      );
    });

    it.skip('should allow a choice with profiles to be constrained such that only the target profile is constrained and others remain as-is', () => {
      // Cannot find any examples to use for testing.  Will revisit when we can reference FSH profiles
    });

    it('should allow Resource to be constrained to multiple resources and profiles when it is specifically targeted', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      const resourceConstraint = new OnlyRule('entry.resource');
      resourceConstraint.types = [
        { type: 'Practitioner' },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight' },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyweight' },
        { type: 'http://hl7.org/fhir/StructureDefinition/familymemberhistory-genetic' },
        { type: 'http://hl7.org/fhir/StructureDefinition/Procedure' }
      ];
      entryResource.constrainType(resourceConstraint, fisher, 'Resource');
      expect(entryResource.type).toHaveLength(4);
      expect(entryResource.type[0]).toEqual(new ElementDefinitionType('Practitioner'));
      expect(entryResource.type[1]).toEqual(
        new ElementDefinitionType('Observation').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/bodyheight',
          'http://hl7.org/fhir/StructureDefinition/bodyweight'
        )
      );
      expect(entryResource.type[2]).toEqual(
        new ElementDefinitionType('FamilyMemberHistory').withProfiles(
          'http://hl7.org/fhir/StructureDefinition/familymemberhistory-genetic'
        )
      );
      expect(entryResource.type[3]).toEqual(new ElementDefinitionType('Procedure'));
    });

    it('should allow a reference to multiple resource types to be constrained to a reference to a subset', () => {
      const performer = observation.elements.find(e => e.id === 'Observation.performer');
      const performerConstraint = new OnlyRule('performer');
      performerConstraint.types = [
        { type: 'Practitioner', isReference: true },
        { type: 'Organization', isReference: true }
      ];
      performer.constrainType(performerConstraint, fisher);
      expect(performer.type).toHaveLength(1);
      expect(performer.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner',
          'http://hl7.org/fhir/StructureDefinition/Organization'
        )
      );
    });

    it('should allow a reference to multiple resource types to be constrained to a reference to a single type', () => {
      const performer = observation.elements.find(e => e.id === 'Observation.performer');
      const performerConstraint = new OnlyRule('performer');
      performerConstraint.types = [{ type: 'Organization', isReference: true }];
      performer.constrainType(performerConstraint, fisher);
      expect(performer.type).toHaveLength(1);
      expect(performer.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Organization'
        )
      );
    });

    it('should allow a resource type in a reference to multiple types to be constrained to a single profile', () => {
      const subject = observation.elements.find(e => e.id === 'Observation.subject');
      const subjectConstraint = new OnlyRule('subject');
      subjectConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/actualgroup', isReference: true }
      ];
      subject.constrainType(subjectConstraint, fisher);
      expect(subject.type).toHaveLength(1);
      expect(subject.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/actualgroup'
        )
      );
    });

    it('should allow a resource type in a reference to multiple types to be constrained to multiple profiles', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const hasMemberConstraint = new OnlyRule('hasMember');
      hasMemberConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight', isReference: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyweight', isReference: true }
      ];
      hasMember.constrainType(hasMemberConstraint, fisher);
      expect(hasMember.type).toHaveLength(1);
      expect(hasMember.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bodyheight',
          'http://hl7.org/fhir/StructureDefinition/bodyweight'
        )
      );
    });

    it('should allow us to constrain a reference to a profile whose parent is specified using a versioned canonical URL', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const hasMemberConstraint = new OnlyRule('hasMember');
      hasMemberConstraint.types = [
        {
          type: 'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Observation_Body_Weight',
          isReference: true
        }
      ];
      hasMember.constrainType(hasMemberConstraint, fisher);
      expect(hasMember.type).toHaveLength(1);
      expect(hasMember.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Observation_Body_Weight'
        )
      );
      expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
    });

    it('should log an error when constraining a reference to a profile whose parent is specified using the wrong version', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const hasMemberConstraint = new OnlyRule('hasMember');
      hasMemberConstraint.types = [
        {
          type: 'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Observation_Body_Weight-wrong-parent',
          isReference: true
        }
      ];
      hasMember.constrainType(hasMemberConstraint, fisher);
      expect(hasMember.type).toHaveLength(1);
      expect(hasMember.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Observation_Body_Weight-wrong-parent'
        )
      );
      expect(loggerSpy.getLastMessage('error')).toBe(
        'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Observation_Body_Weight-wrong-parent is based on http://fhir.de/StructureDefinition/observation-de-vitalsign-koerpergewicht version 0.9.34, but SUSHI found version 0.9.13'
      );
    });

    it('should allow a resource type in a reference to multiple types to be constrained to a resource and a single profile', () => {
      const subject = observation.elements.find(e => e.id === 'Observation.subject');
      const subjectConstraint = new OnlyRule('subject');
      subjectConstraint.types = [
        { type: 'Patient', isReference: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/actualgroup', isReference: true }
      ];
      subject.constrainType(subjectConstraint, fisher);
      expect(subject.type).toHaveLength(1);
      expect(subject.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Patient',
          'http://hl7.org/fhir/StructureDefinition/actualgroup'
        )
      );
    });

    it('should allow a reference to a profile to be constrained to a reference to more specific profiles', () => {
      const jsonVitalSigns = defs.fishForFHIR(
        'http://hl7.org/fhir/StructureDefinition/vitalsigns',
        Type.Profile
      );
      const vitalSigns = StructureDefinition.fromJSON(jsonVitalSigns);
      const hasMember = vitalSigns.elements.find(e => e.id === 'Observation.hasMember');
      const hasMemberConstraint = new OnlyRule('hasMember');
      hasMemberConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight', isReference: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyweight', isReference: true }
      ];
      hasMember.constrainType(hasMemberConstraint, fisher);
      expect(hasMember.type).toHaveLength(1);
      expect(hasMember.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bodyheight',
          'http://hl7.org/fhir/StructureDefinition/bodyweight'
        )
      );
    });

    it('should allow a reference to Any to be constrained to a reference to a resource', () => {
      const focus = observation.elements.find(e => e.id === 'Observation.focus');
      const focusConstraint = new OnlyRule('focus');
      focusConstraint.types = [{ type: 'Practitioner', isReference: true }];
      focus.constrainType(focusConstraint, fisher);
      expect(focus.type).toHaveLength(1);
      expect(focus.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner'
        )
      );
    });

    it('should allow a reference to Any to be constrained to a reference to a profile', () => {
      const focus = observation.elements.find(e => e.id === 'Observation.focus');
      const focusConstraint = new OnlyRule('focus');
      focusConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bp', isReference: true }
      ];
      focus.constrainType(focusConstraint, fisher);
      expect(focus.type).toHaveLength(1);
      expect(focus.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bp'
        )
      );
    });

    it('should allow a reference to Any to be constrained to multiple references', () => {
      const focus = observation.elements.find(e => e.id === 'Observation.focus');
      const focusConstraint = new OnlyRule('focus');
      focusConstraint.types = [
        { type: 'Practitioner', isReference: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/bp', isReference: true }
      ];
      focus.constrainType(focusConstraint, fisher);
      expect(focus.type).toHaveLength(1);
      expect(focus.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner',
          'http://hl7.org/fhir/StructureDefinition/bp'
        )
      );
    });

    it('should allow a reference to multiple resource types to be constrained such that only the target reference is constrained and others remain as-is', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const hasMemberConstraint = new OnlyRule('hasMember');
      hasMemberConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight', isReference: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyweight', isReference: true }
      ];
      hasMember.constrainType(hasMemberConstraint, fisher, 'Observation');
      expect(hasMember.type).toHaveLength(1);
      expect(hasMember.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bodyheight',
          'http://hl7.org/fhir/StructureDefinition/bodyweight',
          'http://hl7.org/fhir/StructureDefinition/QuestionnaireResponse',
          'http://hl7.org/fhir/StructureDefinition/MolecularSequence'
        )
      );
    });

    // start canonicals

    it('should allow a canonical to multiple resource types to be constrained to a canonical to a subset', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [
        { type: 'ActivityDefinition', isCanonical: true },
        { type: 'Questionnaire', isCanonical: true }
      ];
      actionDef.constrainType(performerConstraint, fisher);
      expect(actionDef.type).toHaveLength(1);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/ActivityDefinition',
          'http://hl7.org/fhir/StructureDefinition/Questionnaire'
        )
      );
    });

    it('should allow a canonical to multiple resource types to be constrained with a versioned canonical', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [
        { type: 'ActivityDefinition', isCanonical: true },
        { type: 'Questionnaire|4.0.1', isCanonical: true }
      ];
      actionDef.constrainType(performerConstraint, fisher);
      expect(actionDef.type).toHaveLength(1);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/ActivityDefinition',
          'http://hl7.org/fhir/StructureDefinition/Questionnaire|4.0.1'
        )
      );
    });

    it('should allow a canonical to multiple resource types to be constrained to a canonical to a single type', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [{ type: 'Questionnaire', isCanonical: true }];
      actionDef.constrainType(performerConstraint, fisher);
      expect(actionDef.type).toHaveLength(1);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Questionnaire'
        )
      );
    });

    it('should allow a resource type in a canonical to multiple types to be constrained to a single profile', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [
        {
          type: 'http://hl7.org/fhir/StructureDefinition/shareableplandefinition',
          isCanonical: true
        }
      ];
      actionDef.constrainType(performerConstraint, fisher);
      expect(actionDef.type).toHaveLength(1);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/shareableplandefinition'
        )
      );
    });

    it('should allow a resource type in a canonical to multiple types to be constrained to multiple profiles', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [
        {
          type: 'http://hl7.org/fhir/StructureDefinition/shareableplandefinition',
          isCanonical: true
        },
        {
          type: 'http://hl7.org/fhir/StructureDefinition/computableplandefinition',
          isCanonical: true
        }
      ];
      actionDef.constrainType(performerConstraint, fisher);
      expect(actionDef.type).toHaveLength(1);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/shareableplandefinition',
          'http://hl7.org/fhir/StructureDefinition/computableplandefinition'
        )
      );
    });

    it('should allow a resource type in a canonical to multiple types to be constrained to a resource and a single profile', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [
        {
          type: 'http://hl7.org/fhir/StructureDefinition/ActivityDefinition',
          isCanonical: true
        },
        {
          type: 'http://hl7.org/fhir/StructureDefinition/computableplandefinition',
          isCanonical: true
        }
      ];
      actionDef.constrainType(performerConstraint, fisher);
      expect(actionDef.type).toHaveLength(1);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/ActivityDefinition',
          'http://hl7.org/fhir/StructureDefinition/computableplandefinition'
        )
      );
    });

    it('should allow a canonical to Any to be constrained to a canonical to a resource', () => {
      const value = extension.elements.find(e => e.id === 'Extension.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [{ type: 'Practitioner', isCanonical: true }];
      value.constrainType(valueConstraint, fisher);
      expect(value.type).toHaveLength(1);
      expect(value.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner'
        )
      );
    });

    it('should allow a canonical to Any to be constrained to a canonical to a profile', () => {
      const value = extension.elements.find(e => e.id === 'Extension.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bp', isCanonical: true }
      ];
      value.constrainType(valueConstraint, fisher);
      expect(value.type).toHaveLength(1);
      expect(value.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bp'
        )
      );
    });

    it('should allow a canonical to Any to be constrained to multiple canonicals', () => {
      const value = extension.elements.find(e => e.id === 'Extension.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/Practitioner', isCanonical: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/bp', isCanonical: true }
      ];
      value.constrainType(valueConstraint, fisher);
      expect(value.type).toHaveLength(1);
      expect(value.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner',
          'http://hl7.org/fhir/StructureDefinition/bp'
        )
      );
    });

    it('should allow a canonical to Any to be constrained to a canonical with a version', () => {
      const value = extension.elements.find(e => e.id === 'Extension.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/Practitioner|4.0.1', isCanonical: true }
      ];
      value.constrainType(valueConstraint, fisher);
      expect(value.type).toHaveLength(1);
      expect(value.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner|4.0.1'
        )
      );
    });

    it('should allow a canonical to Any to be constrained to a profile with a version', () => {
      const value = extension.elements.find(e => e.id === 'Extension.value[x]');
      const valueConstraint = new OnlyRule('value[x]');
      valueConstraint.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bp|4.0.1', isCanonical: true }
      ];
      value.constrainType(valueConstraint, fisher);
      expect(value.type).toHaveLength(1);
      expect(value.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bp|4.0.1'
        )
      );
    });

    it('should output the canonical with the version preceding the fragment when the url has both a version and a fragment', () => {});

    it('should allow a canonical to multiple resource types to be constrained such that only the target reference is constrained and others remain as-is', () => {
      const actionDef = planDefinition.elements.find(
        e => e.id === 'PlanDefinition.action.definition[x]'
      );
      const performerConstraint = new OnlyRule('action.definition[x]');
      performerConstraint.types = [
        {
          type: 'http://hl7.org/fhir/StructureDefinition/shareableplandefinition',
          isCanonical: true
        },
        {
          type: 'http://hl7.org/fhir/StructureDefinition/computableplandefinition',
          isCanonical: true
        }
      ];
      actionDef.constrainType(performerConstraint, fisher, 'PlanDefinition');
      expect(actionDef.type).toHaveLength(2);
      expect(actionDef.type[0]).toEqual(
        new ElementDefinitionType('canonical').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/ActivityDefinition',
          'http://hl7.org/fhir/StructureDefinition/shareableplandefinition',
          'http://hl7.org/fhir/StructureDefinition/computableplandefinition',
          'http://hl7.org/fhir/StructureDefinition/Questionnaire'
        )
      );
      expect(actionDef.type[1]).toEqual(new ElementDefinitionType('uri'));
    });

    // end canonicals

    it('should throw InvalidTypeError when a passed in type cannot constrain any existing types', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const clone = cloneDeep(valueX);
      expect(() => {
        const valueConstraint = new OnlyRule('value[x]');
        valueConstraint.types = [{ type: 'decimal' }];
        clone.constrainType(valueConstraint, fisher);
      }).toThrow(/"decimal" does not match .* Quantity or CodeableConcept or string/);
      expect(clone).toEqual(valueX);
    });

    it('should throw InvalidTypeError when a passed in reference to a type that cannot constrain any existing references to types', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.performer');
      const clone = cloneDeep(valueX);
      expect(() => {
        const performerConstraint = new OnlyRule('performer');
        performerConstraint.types = [{ type: 'Medication', isReference: true }];
        clone.constrainType(performerConstraint, fisher);
      }).toThrow(
        /"Reference\(Medication\)" does not match .* Reference\(http:\/\/hl7.org\/fhir\/StructureDefinition\/Practitioner | http:\/\/hl7.org\/fhir\/StructureDefinition\/PractitionerRole .*\)/
      );
      expect(clone).toEqual(valueX);
    });

    it('should throw InvalidTypeError when attempting to constrain Resource to a reference', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      const clone = cloneDeep(entryResource);
      expect(() => {
        const resourceConstraint = new OnlyRule('entry.resource');
        resourceConstraint.types = [{ type: 'Procedure', isReference: true }];
        clone.constrainType(resourceConstraint, fisher);
      }).toThrow(/"Reference\(Procedure\)" does not match .* Resource/);
      expect(clone).toEqual(entryResource);
    });

    it('should throw InvalidTypeError when the targetType does not match any existing types', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const clone = cloneDeep(hasMember);
      expect(() => {
        const hasMemberConstraint = new OnlyRule('hasMember');
        hasMemberConstraint.types = [
          {
            type: 'http://hl7.org/fhir/StructureDefinition/familymemberhistory-genetic',
            isReference: true
          }
        ];
        clone.constrainType(hasMemberConstraint, fisher, 'FamilyMemberHistory');
      }).toThrow(
        /"FamilyMemberHistory" does not match .* Reference\(http:\/\/hl7.org\/fhir\/StructureDefinition\/Observation .*\)/
      );
      expect(clone).toEqual(hasMember);
    });

    it('should throw InvalidTypeError when the passed in type does not match the targetType', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const clone = cloneDeep(valueX);
      expect(() => {
        const valueConstraint = new OnlyRule('value[x]');
        valueConstraint.types = [{ type: 'SimpleQuantity' }];
        clone.constrainType(valueConstraint, fisher, 'CodeableConcept');
      }).toThrow(/"SimpleQuantity" does not match .* CodeableConcept/);
      expect(clone).toEqual(valueX);
    });

    it('should throw InvalidTypeError when the passed in reference type does not match the targetType', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const clone = cloneDeep(hasMember);
      expect(() => {
        const hasMemberConstraint = new OnlyRule('hasMember');
        hasMemberConstraint.types = [
          { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight', isReference: true }
        ];
        clone.constrainType(hasMemberConstraint, fisher, 'QuestionnaireResponse');
      }).toThrow(
        /"Reference\(http:\/\/hl7.org\/fhir\/StructureDefinition\/bodyheight\)" does not match .* Reference\(http:\/\/hl7.org\/fhir\/StructureDefinition\/QuestionnaireResponse\)/
      );
      expect(clone).toEqual(hasMember);
    });

    it('should throw InvalidTypeError when attempting to constrain a reference when the target type is Resource', () => {
      const bundle = fisher.fishForStructureDefinition('Bundle');
      const entryResource = bundle.elements.find(e => e.id === 'Bundle.entry.resource');
      const clone = cloneDeep(entryResource);
      expect(() => {
        const resourceConstraint = new OnlyRule('entry.resource');
        resourceConstraint.types = [{ type: 'Procedure', isReference: true }];
        clone.constrainType(resourceConstraint, fisher, 'Resource');
      }).toThrow(/"Reference\(Procedure\)" does not match .* Resource/);
      expect(clone).toEqual(entryResource);
    });

    it('should throw TypeNotFoundError when a passed in type definition cannot be found', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const clone = cloneDeep(valueX);
      expect(() => {
        const valueConstraint = new OnlyRule('value[x]');
        valueConstraint.types = [{ type: 'Quantity' }, { type: 'Monocle' }];
        clone.constrainType(valueConstraint, fisher);
      }).toThrow(/No definition for the type "Monocle" could be found./);
      expect(clone).toEqual(valueX);
    });

    it('should throw TypeNotFoundError when a passed in reference types definition cannot be found', () => {
      const performer = observation.elements.find(e => e.id === 'Observation.performer');
      const clone = cloneDeep(performer);
      expect(() => {
        const performerConstraint = new OnlyRule('performer');
        performerConstraint.types = [
          { type: 'Practitioner', isReference: true },
          { type: 'Juggler', isReference: true }
        ];
        clone.constrainType(performerConstraint, fisher);
      }).toThrow(/No definition for the type "Juggler" could be found./);
      expect(clone).toEqual(performer);
    });

    it('should throw TypeNotFoundError when the targetType definition cannot be found', () => {
      const hasMember = observation.elements.find(e => e.id === 'Observation.hasMember');
      const clone = cloneDeep(hasMember);
      expect(() => {
        const hasMemberConstraint = new OnlyRule('hasMember');
        hasMemberConstraint.types = [
          { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight', isReference: true }
        ];
        clone.constrainType(hasMemberConstraint, fisher, 'VitalBillboards');
      }).toThrow(/No definition for the type "VitalBillboards" could be found./);
      expect(clone).toEqual(hasMember);
    });

    it('should throw NonAbstractParentError when constraining a non-abstract parent to a specialization of it', () => {
      const valueX = observation.elements.find(e => e.id === 'Observation.value[x]');
      const clone = cloneDeep(valueX);
      expect(() => {
        const valueConstraint = new OnlyRule('value[x]');
        valueConstraint.types = [{ type: 'Duration' }];
        clone.constrainType(valueConstraint, fisher);
      }).toThrow(
        /The type Quantity is not abstract, so it cannot be constrained to the specialization Duration/
      );
      expect(clone).toEqual(valueX);
    });
  });
});

describe('ElementDefinition R5', () => {
  let defs: FHIRDefinitions;
  let r5CarePlan: StructureDefinition;
  let fisher: TestFisher;
  let pkg: Package;

  beforeAll(() => {
    defs = new FHIRDefinitions();
    loadFromPath(path.join(__dirname, '..', 'testhelpers', 'testdefs'), 'r5-definitions', defs);
    pkg = new Package(minimalConfig);
    fisher = new TestFisher()
      .withFHIR(defs)
      .withPackage(pkg)
      .withCachePackageName('hl7.fhir.r5.core#current')
      .withTestPackageName('r5-definitions');
  });

  beforeEach(() => {
    r5CarePlan = fisher.fishForStructureDefinition('CarePlan');
  });

  describe('#constrainType()', () => {
    it('should allow a CodeableReference to multiple resource types to be constrained to a reference to a subset', () => {
      const performedActivity = r5CarePlan.elements.find(
        e => e.id === 'CarePlan.activity.performedActivity'
      );
      const onlyRule = new OnlyRule('activity.performedActivity');
      onlyRule.types = [
        { type: 'Practitioner', isReference: true },
        { type: 'Organization', isReference: true }
      ];
      performedActivity.constrainType(onlyRule, fisher);
      expect(performedActivity.type).toHaveLength(1);
      expect(performedActivity.type[0]).toEqual(
        new ElementDefinitionType('CodeableReference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner',
          'http://hl7.org/fhir/StructureDefinition/Organization'
        )
      );
    });

    it('should allow a CodeableReference to multiple resource types to be constrained to a reference to a single type', () => {
      const performedActivity = r5CarePlan.elements.find(
        e => e.id === 'CarePlan.activity.performedActivity'
      );
      const onlyRule = new OnlyRule('activity.performedActivity');
      onlyRule.types = [{ type: 'Practitioner', isReference: true }];
      performedActivity.constrainType(onlyRule, fisher);
      expect(performedActivity.type).toHaveLength(1);
      expect(performedActivity.type[0]).toEqual(
        new ElementDefinitionType('CodeableReference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Practitioner'
        )
      );
    });

    it('should allow a CodeableReference to multiple resource types to be constrained to a reference to a single profile', () => {
      const performedActivity = r5CarePlan.elements.find(
        e => e.id === 'CarePlan.activity.performedActivity'
      );
      const onlyRule = new OnlyRule('activity.performedActivity');
      onlyRule.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/actualgroup', isReference: true }
      ];
      performedActivity.constrainType(onlyRule, fisher);
      expect(performedActivity.type).toHaveLength(1);
      expect(performedActivity.type[0]).toEqual(
        new ElementDefinitionType('CodeableReference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/actualgroup'
        )
      );
    });

    it('should allow a CodeableReference to multiple resource types to be constrained to a reference to a single profile', () => {
      const performedActivity = r5CarePlan.elements.find(
        e => e.id === 'CarePlan.activity.performedActivity'
      );
      const onlyRule = new OnlyRule('activity.performedActivity');
      onlyRule.types = [
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyheight', isReference: true },
        { type: 'http://hl7.org/fhir/StructureDefinition/bodyweight', isReference: true }
      ];
      performedActivity.constrainType(onlyRule, fisher);
      expect(performedActivity.type).toHaveLength(1);
      expect(performedActivity.type[0]).toEqual(
        new ElementDefinitionType('CodeableReference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/bodyheight',
          'http://hl7.org/fhir/StructureDefinition/bodyweight'
        )
      );
    });

    it('should constrain an element to Reference type with the Reference() keyword when both Reference and CodeableReference is allowed', () => {
      // R5 Extension allows both Reference and CodeableReference types
      const r5Extension = fisher.fishForStructureDefinition('Extension');
      const valueX = r5Extension.elements.find(e => e.id === 'Extension.value[x]');
      // * value[x] only Reference(Resource)
      const onlyRule = new OnlyRule('value[x]');
      onlyRule.types = [{ type: 'Resource', isReference: true }];
      valueX.constrainType(onlyRule, fisher);
      expect(valueX.type).toHaveLength(1);
      expect(valueX.type[0]).toEqual(
        new ElementDefinitionType('Reference').withTargetProfiles(
          'http://hl7.org/fhir/StructureDefinition/Resource'
        )
      );
    });

    it('should throw InvalidTypeError when a passed in reference to a type that cannot constrain any existing references to types on a CodeableReference', () => {
      const addresses = r5CarePlan.elements.find(e => e.id === 'CarePlan.addresses');
      const onlyRule = new OnlyRule('addresses');
      onlyRule.types = [{ type: 'Patient', isReference: true }];
      expect(() => {
        addresses.constrainType(onlyRule, fisher);
      }).toThrow(/"Reference\(Patient\).*Reference\(.*Condition\)/);
    });
  });
});
