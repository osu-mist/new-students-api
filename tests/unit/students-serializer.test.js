/* eslint no-unused-expressions: 0 */

const appRoot = require('app-root-path');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiSubset = require('chai-subset');
const _ = require('lodash');
const randomize = require('randomatic');
const sinon = require('sinon');

const studentsSerializer = appRoot.require('api/v1/serializers/students-serializer');
const { openapi } = appRoot.require('utils/load-openapi');

chai.should();
chai.use(chaiAsPromised);
chai.use(chaiSubset);
const { expect } = chai;

describe('Test students-serializer', () => {
  const fakeId = 'fakeId';
  const fakeBaseUrl = `/v1/students/${fakeId}`;
  const resourceSubsetSchema = (resourceType, resourceAttributes) => {
    const schema = {
      links: {
        self: `${fakeBaseUrl}/${resourceType}`,
      },
      data: {
        id: fakeId,
        type: resourceType,
        links: { self: null },
      },
    };
    if (resourceAttributes) {
      schema.data.attributes = resourceAttributes;
    }
    return schema;
  };

  /**
   * @summary Helper function for lite-testing single resource
   * @function
   * @param {object} serializedResource serialized resource
   * @param {string} resourceType resource type
   * @param {string} nestedProps field name of the nested properties
   */
  const testSingleResource = (serializedResource, resourceType, nestedProps) => {
    expect(serializedResource).to.containSubset(resourceSubsetSchema(resourceType));

    if (nestedProps) {
      expect(serializedResource).have.nested.property(`data.attributes.${nestedProps}`);
    }
  };

  /**
   * @summary Helper function for lite-testing multiple resources
   * @function
   * @param {Object} serializedResources serialized resources
   * @returns {Object} data object from serialized resources for further use
   */
  const testMultipleResources = (serializedResources) => {
    const serializedResourcesData = serializedResources.data;
    expect(serializedResources).to.have.keys('data', 'links');
    expect(serializedResourcesData).to.be.an('array');

    return serializedResourcesData;
  };

  /**
   * @summary Helper function to get definition from openapi specification
   * @function
   * @param {Object} definition the name of definition
   * @param {Object} nestedOption nested option
   * @returns {Object}
   */
  const getDefinitionProps = (definition, nestedOption) => {
    let result = openapi.definitions[definition].properties;
    if (nestedOption) {
      const { dataItem, dataField } = nestedOption;
      if (dataItem) {
        result = result.data.items.properties.attributes.properties;
      } else if (dataField) {
        result = result.data.properties.attributes.properties[dataField].items.properties;
      }
    }
    return result;
  };

  /**
   * @summary Helper function to check certain fields are parsed as numbers
   * @function
   * @param {Object} resource resource to be checked
   * @param {String[]} numberFields numbers fields
   */
  const expectNumberFields = (resource, numberFields) => {
    _.each(numberFields, (numberField) => {
      expect(resource[numberField]).to.be.a('number');
    });
  };

  it('test fourDigitToTime', () => {
    const { fourDigitToTime } = studentsSerializer;
    expect(fourDigitToTime(null)).to.be.null;

    const invalidStrings = [];
    while (invalidStrings.length < 10) {
      const length = Math.floor(Math.random() * Math.floor(10));
      if (length !== 4) {
        invalidStrings.push(randomize('aA0!', length));
      } else {
        invalidStrings.push(randomize('aA!', length));
      }
    }
    _.each(invalidStrings, (string) => {
      expect(fourDigitToTime(string)).to.equal('Incorrect time format');
    });

    const validStrings = [];
    while (validStrings.length < 10) {
      validStrings.push(randomize('0', 4));
    }
    _.each(validStrings, (string) => {
      expect(fourDigitToTime(string)).to.equal(`${string.substring(0, 2)}:${string.substring(2, 4)}:00`);
    });
  });
  it('test getSerializerArgs', () => {
    const { getSerializerArgs } = studentsSerializer;
    const fakeType = 'fakeType';
    const fakePath = 'fakePath';
    const fakePathUrl = `${fakeBaseUrl}/${fakePath}`;
    const fakeDataSchema = {
      properties: {
        type: {
          enum: [fakeType],
        },
        attributes: {
          properties: {
            fakeAttribute1: null,
            fakeAttribute2: null,
            fakeAttribute3: null,
          },
        },
      },
    };
    const fakeDefinitions = {
      fakeSingleResult: {
        properties: {
          data: fakeDataSchema,
        },
      },
      fakePluralResult: {
        properties: {
          data: {
            type: 'array',
            items: fakeDataSchema,
          },
        },
      },
    };

    sinon.stub(openapi, 'definitions').value(fakeDefinitions);

    const testCases = [
      {
        isSingle: true,
        expectedResult: 'fakeSingleResult',
        fakeParams: {},
        expectedLink: fakePathUrl,
      },
      {
        isSingle: true,
        expectedResult: 'fakeSingleResult',
        fakeParams: { fakeKey: 'fakeValue' },
        expectedLink: `${fakePathUrl}?fakeKey=fakeValue`,
      },
      {
        isSingle: true,
        expectedResult: 'fakeSingleResult',
        fakeParams: undefined,
        expectedLink: fakePathUrl,
      },
      {
        isSingle: false,
        expectedResult: 'fakePluralResult',
        fakeParams: undefined,
        expectedLink: fakePathUrl,
      },
    ];

    _.each(testCases, (testCase) => {
      const {
        isSingle,
        fakeParams,
        expectedLink,
        expectedResult,
      } = testCase;
      const expectedArgs = {
        identifierField: 'identifierField',
        resourceKeys: ['fakeAttribute1', 'fakeAttribute2', 'fakeAttribute3'],
        resourcePath: 'student',
        topLevelSelfLink: expectedLink,
        enableDataLinks: false,
        resourceType: fakeType,
      };

      const actualArgs = getSerializerArgs(fakeId, expectedResult, fakePath, isSingle, fakeParams);
      expect(actualArgs).to.deep.equal(expectedArgs);
    });

    sinon.restore();
  });
  it('test serializeGpa', () => {
    const { serializeGpa } = studentsSerializer;
    const resourceType = 'gpa';
    const rawGpaLevels = [
      {
        gpa: '3.96',
        gpaCreditHours: '103',
        gpaType: 'Institution',
        creditHoursAttempted: '107',
        creditHoursEarned: '107',
        creditHoursPassed: '107',
        level: 'Undergraduate',
        qualityPoints: '407.50',
      },
      {
        gpa: '3.97',
        gpaCreditHours: '146',
        gpaType: 'Overall',
        creditHoursAttempted: '174',
        creditHoursEarned: '174',
        creditHoursPassed: '174',
        level: 'Undergraduate',
        qualityPoints: '579.50',
      },
    ];

    const serializedGpaLevels = serializeGpa(rawGpaLevels, fakeId);
    testSingleResource(serializedGpaLevels, resourceType, 'gpaLevels');

    const numberFields = [
      'gpaCreditHours', 'creditHoursAttempted', 'creditHoursEarned', 'creditHoursPassed',
    ];
    const { gpaLevels } = serializedGpaLevels.data.attributes;
    _.each(gpaLevels, (gpaLevel) => {
      expect(gpaLevel).to.have.all.keys(_.keys(getDefinitionProps('GradePointAverage')));
      expectNumberFields(gpaLevel, numberFields);
    });
  });
  it('test serializeAccountBalance', () => {
    const { serializeAccountBalance } = studentsSerializer;
    const resourceType = 'account-balance';
    const rawAccountBalance = {
      identifierField: fakeId,
      currentBalance: '99.99',
    };

    const serializedAccountBalance = serializeAccountBalance(rawAccountBalance, fakeId);
    testSingleResource(serializedAccountBalance, resourceType);
    expect(serializedAccountBalance.data.attributes.currentBalance).to.be.a('number');
  });
  it('test serializeAccountTransactions', () => {
    const { serializeAccountTransactions } = studentsSerializer;
    const resourceType = 'account-transactions';
    const rawTransactions = [
      {
        amount: '2850',
        description: 'Ford Loan-Subsidized',
        entryDate: '2016-12-31 12:29:54',
      },
      {
        amount: '1814',
        description: 'Presidential Scholar 001100',
        entryDate: '2017-11-12 12:13:42',
      },
    ];

    const serializedTransactions = serializeAccountTransactions(rawTransactions, fakeId);
    testSingleResource(serializedTransactions, resourceType, 'transactions');

    const { transactions } = serializedTransactions.data.attributes;
    _.each(transactions, (transaction) => {
      expect(transaction).to.have.all.keys(_.keys(
        getDefinitionProps('AccountTransactionsResult', { dataField: 'transactions' }),
      ));
      expect(Date.parse(transaction.entryDate)).to.not.be.NaN;
      expectNumberFields(transaction, ['amount']);
    });
  });
  it('test serializeAcademicStatus', () => {
    const { serializeAcademicStatus } = studentsSerializer;
    const resourceType = 'academic-status';
    const rawAcademicStatus = [
      {
        academicStanding: 'Good Standing',
        term: '201803',
        termDescription: 'Spring 2018',
        gpa: '4.00',
        gpaCreditHours: '14',
        gpaType: 'Institution',
        creditHoursAttempted: '14',
        creditHoursEarned: '14',
        creditHoursPassed: '14',
        level: 'Undergraduate',
        qualityPoints: '56.00',
      },
      {
        academicStanding: 'Good Standing',
        term: '201901',
        termDescription: 'Fall 2018',
        gpa: '4.00',
        gpaCreditHours: '15',
        gpaType: 'Institution',
        creditHoursAttempted: '16',
        creditHoursEarned: '16',
        creditHoursPassed: '16',
        level: 'Undergraduate',
        qualityPoints: '60.00',
      },
    ];

    const serializedAcademicStatus = serializeAcademicStatus(rawAcademicStatus, fakeId);
    const serializedAcademicStatusData = testMultipleResources(serializedAcademicStatus);

    _.each(serializedAcademicStatusData, (resource) => {
      expect(resource)
        .to.contains.keys('attributes')
        .and.to.containSubset({
          id: `${fakeId}-${resource.attributes.term}`,
          type: resourceType,
          links: { self: null },
        });

      const { attributes } = resource;
      expect(attributes).to.have.all.keys(_.keys(
        getDefinitionProps('AcademicStatusResult', { dataItem: true }),
      ));

      const numberFields = [
        'gpaCreditHours', 'creditHoursAttempted', 'creditHoursEarned', 'creditHoursPassed',
      ];
      _.each(attributes.gpa, (gpaLevel) => {
        expect(gpaLevel).to.have.all.keys(_.keys(getDefinitionProps('GradePointAverage')));
        expectNumberFields(gpaLevel, numberFields);
      });
    });
  });
  it('test serializeClassification', () => {
    const { serializeClassification } = studentsSerializer;
    const resourceType = 'classification';
    const rawClassification = {
      identifierField: fakeId,
      level: 'Graduate',
      classification: 'Determine from Student Type',
    };

    const serializedClassification = serializeClassification(rawClassification, fakeId);
    testSingleResource(serializedClassification, resourceType);
  });
  it('test serializeGrades', () => {
    const { serializeGrades } = studentsSerializer;
    const resourceType = 'grades';
    const rawGrades = [
      {
        identifierField: `${fakeId}-200803-37626`,
        courseReferenceNumber: '37626',
        gradeFinal: 'A',
        courseSubject: 'SPAN',
        courseSubjectDescription: 'Spanish',
        courseNumber: '336',
        courseTitle: '*LATIN AMERICAN CULTURE',
        sectionNumber: '001',
        term: '200803',
        termDescription: 'Spring 2008',
        scheduleType: 'A',
        scheduleDescription: 'Lecture',
        creditHours: '3',
        tcknCourseLevel: 'Non-Degree / Credential',
        sfrstcrCourseLevel: null,
        registrationStatus: null,
        gradeMode: 'N',
        gradeModeDescription: 'Normal Grading Mode',
      },
      {
        identifierField: `${fakeId}-201900-72004`,
        courseReferenceNumber: '72004',
        gradeFinal: 'B',
        courseSubject: 'FW',
        courseSubjectDescription: 'Fisheries and Wildlife',
        courseNumber: '427',
        courseTitle: 'PRINCIPLES OF WILDLIFE DISEASE',
        sectionNumber: '400',
        term: '201900',
        termDescription: 'Summer 2018',
        scheduleType: 'Y',
        scheduleDescription: 'Online',
        creditHours: '4',
        tcknCourseLevel: 'Undergraduate',
        sfrstcrCourseLevel: 'E-Campus Undergraduate Course',
        registrationStatus: '**Web Registered**',
        gradeMode: 'N',
        gradeModeDescription: 'Normal Grading Mode',
      },
    ];

    const serializedGrades = serializeGrades(rawGrades, fakeId);
    const serializedGradesData = testMultipleResources(serializedGrades);

    let index = 0;
    _.each(serializedGradesData, (resource) => {
      const { sfrstcrCourseLevel, tcknCourseLevel } = rawGrades[index];
      expect(resource)
        .to.contains.keys('attributes')
        .and.to.containSubset({
          id: `${fakeId}-${resource.attributes.term}-${resource.attributes.courseReferenceNumber}`,
          type: resourceType,
          links: { self: null },
        });

      const { attributes } = resource;
      expect(attributes).to.have.all.keys(_.keys(
        getDefinitionProps('GradesResult', { dataItem: true }),
      ));
      expectNumberFields(attributes, ['creditHours']);
      expect(attributes.courseLevel).to.equal(sfrstcrCourseLevel || tcknCourseLevel);
      index += 1;
    });
  });
  it('test serializeClassSchedule', () => {
    const { serializeClassSchedule } = studentsSerializer;
    const resourceType = 'class-schedule';
    const rawClassSchedule = [
      {
        academicYear: '0405',
        academicYearDescription: 'Academic Year 2004-05',
        courseReferenceNumber: '37430',
        courseSubject: 'RNG',
        courseSubjectDescription: 'Rangeland Ecology & Management',
        courseNumber: '399',
        courseTitleShort: 'SPECIAL TOPICS',
        courseTitleLong: null,
        sectionNumber: '001',
        term: '200503',
        termDescription: 'Spring 2005',
        scheduleType: 'F',
        scheduleDescription: 'Independent or Special Studies',
        creditHours: '2',
        registrationStatus: '**Web Registered**',
        gradingMode: 'Normal Grading Mode',
        continuingEducation: null,
        facultyOsuId: '930608969',
        facultyName: 'Ehrhart, Robert',
        facultyEmail: 'Bob.Ehrhart@oregonstate.edu',
        facultyPrimary: 'Y',
        beginDate: '2005-03-28',
        beginTime: null,
        endDate: '2005-06-03',
        endTime: null,
        room: null,
        building: null,
        buildingDescription: null,
        campus: 'Oregon State - Cascades',
        hoursPerWeek: '0',
        creditHourSession: '2',
        meetingScheduleType: 'F',
        meetingScheduleDescription: 'Independent or Special Studies',
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
      },
      {
        academicYear: '0405',
        academicYearDescription: 'Academic Year 2004-05',
        courseReferenceNumber: '35301',
        courseSubject: 'BIO',
        courseSubjectDescription: 'Biology-UO',
        courseNumber: '370-U',
        courseTitleShort: 'UO. ECOLOGY',
        courseTitleLong: null,
        sectionNumber: '001',
        term: '200503',
        termDescription: 'Spring 2005',
        scheduleType: 'A',
        scheduleDescription: 'Lecture',
        creditHours: '4',
        registrationStatus: '**Web Registered**',
        gradingMode: 'Normal Grading Mode',
        continuingEducation: null,
        facultyOsuId: '930828000',
        facultyName: 'Clark, Lisa',
        facultyEmail: null,
        facultyPrimary: 'Y',
        beginDate: '2005-03-28',
        beginTime: '1900',
        endDate: '2005-06-03',
        endTime: '2030',
        room: '201',
        building: 'CSB',
        buildingDescription: 'Cascades Hall (COOSU)',
        campus: 'Oregon State - Cascades',
        hoursPerWeek: '3',
        creditHourSession: '4',
        meetingScheduleType: 'A',
        meetingScheduleDescription: 'Lecture',
        monday: null,
        tuesday: 'T',
        wednesday: null,
        thursday: 'R',
        friday: null,
        saturday: null,
        sunday: null,
      },
    ];
    const serializedClassSchedule = serializeClassSchedule(rawClassSchedule, fakeId);
    const serializedClassScheduleData = testMultipleResources(serializedClassSchedule);
    const classScheduleAttribute = getDefinitionProps('ClassScheduleResult', { dataItem: true });

    let index = 0;
    _.each(serializedClassScheduleData, (resource) => {
      const { courseTitleLong, courseTitleShort, continuingEducation } = rawClassSchedule[index];
      expect(resource)
        .to.contains.keys('attributes')
        .and.to.containSubset({
          id: `${fakeId}-${resource.attributes.term}-${resource.attributes.courseReferenceNumber}`,
          type: resourceType,
          links: { self: null },
        });

      const { attributes } = resource;
      expect(attributes).to.have.all.keys(_.keys(classScheduleAttribute));
      expectNumberFields(attributes, ['creditHours']);
      expect(attributes.courseTitle).to.equal(courseTitleLong || courseTitleShort);
      expect(attributes.continuingEducation).to.equal(continuingEducation === 'Y');

      const { faculty, meetingTimes } = attributes;

      _.each(faculty, (f) => {
        expect(f).to.have.all.keys(_.keys(classScheduleAttribute.faculty.items.properties));
        expect(f.primary).to.equal(rawClassSchedule[index].facultyPrimary === 'Y');
      });

      const numberFields = ['hoursPerWeek', 'creditHourSession'];
      _.each(meetingTimes, (m) => {
        expect(m).to.have.all.keys(_.keys(classScheduleAttribute.meetingTimes.items.properties));
        expectNumberFields(m, numberFields);
        expect(m.weeklySchedule).to.be.an('array');
        _.each(m.weeklySchedule, (dailySchedule) => {
          expect(dailySchedule).to.be.oneOf(['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']);
        });
      });
      index += 1;
    });
  });
  it('test serializeHolds', () => {
    const { serializeHolds } = studentsSerializer;
    const resourceType = 'holds';
    const rawHolds = [
      {
        fromDate: '2011-12-28',
        toDate: '2099-12-31',
        reason: 'ACTG 321',
        description: 'Missing Requirements',
        registration: null,
        transcript: null,
        graduation: 'Graduation',
        grades: null,
        accountsReceivable: null,
        enrollmentVerification: null,
        application: null,
        compliance: null,
      },
      {
        fromDate: '2011-12-28',
        toDate: '2099-12-31',
        reason: 'Has not applied as Postbac',
        description: 'Must Apply as Postbac',
        registration: 'Registration',
        transcript: null,
        graduation: 'Graduation',
        grades: null,
        accountsReceivable: null,
        enrollmentVerification: null,
        application: null,
        compliance: null,
      },
    ];
    const processesAffectedKeys = [
      'Registration',
      'Transcript',
      'Graduation',
      'Grades',
      'Accounts Receivable',
      'Enrollment Verification',
      'Application',
      'Compliance',
    ];

    const serializedHolds = serializeHolds(rawHolds, fakeId);
    testSingleResource(serializedHolds, resourceType, 'holds');

    const { holds } = serializedHolds.data.attributes;
    _.each(holds, (hold) => {
      expect(hold).to.have.all.keys(_.keys(
        getDefinitionProps('HoldsResult', { dataField: 'holds' }),
      ));
      _.each(hold.processesAffected, (processesAffectedKey) => {
        expect(processesAffectedKey).to.be.oneOf(processesAffectedKeys);
      });
    });
  });
  it('test serializeWorkStudy', () => {
    const { serializeWorkStudy } = studentsSerializer;
    const resourceType = 'work-study';
    const rawAwards = [
      {
        offerAmount: '1500',
        offerExpirationDate: '2006-06-09',
        acceptedAmount: '1500',
        acceptedDate: '2006-05-12',
        paidAmount: '0',
        awardStatus: 'Accepted',
        effectiveStartDate: '2006-09-25',
        effectiveEndDate: '2007-06-15',
      },
      {
        offerAmount: '0',
        offerExpirationDate: null,
        acceptedAmount: '0',
        acceptedDate: null,
        paidAmount: '0',
        awardStatus: 'Cancelled',
        effectiveStartDate: '2007-06-25',
        effectiveEndDate: '2008-03-21',
      },
    ];

    const serializedWorkStudy = serializeWorkStudy(rawAwards, fakeId);
    testSingleResource(serializedWorkStudy, resourceType, 'awards');

    const { awards } = serializedWorkStudy.data.attributes;
    const numberFields = [
      'offerAmount', 'acceptedAmount', 'paidAmount',
    ];
    _.each(awards, (award) => {
      expect(award).to.have.all.keys(_.keys(
        getDefinitionProps('WorkStudyResult', { dataField: 'awards' }),
      ));
      expectNumberFields(award, numberFields);
    });
  });
  it('test serializeDualEnrollment', () => {
    const { serializeDualEnrollment } = studentsSerializer;
    const resourceType = 'dual-enrollment';
    const rawDualEnrollment = [
      {
        identifierField: `${fakeId}-200503`,
        creditHours: '5',
        term: '200503',
      },
      {
        identifierField: `${fakeId}-200602`,
        creditHours: '8',
        term: '200602',
      },
      {
        identifierField: `${fakeId}-200603`,
        creditHours: '8',
        term: '200603',
      },
      {
        identifierField: `${fakeId}-201900`,
        creditHours: '0',
        term: '201900',
      },
      {
        identifierField: `${fakeId}-201901`,
        creditHours: '0',
        term: '201901',
      },
    ];

    const serializedDualEnrollment = serializeDualEnrollment(rawDualEnrollment, fakeId);
    const serializedDualEnrollmentData = testMultipleResources(serializedDualEnrollment);

    _.each(serializedDualEnrollmentData, (resource) => {
      expect(resource)
        .to.contains.keys('attributes')
        .and.to.containSubset({
          id: `${fakeId}-${resource.attributes.term}`,
          type: resourceType,
          links: { self: null },
        });

      const { attributes } = resource;
      expect(attributes).to.have.all.keys(_.keys(
        getDefinitionProps('DualEnrollmentResult', { dataItem: true }),
      ));
      expectNumberFields(attributes, ['creditHours']);
    });
  });
});
