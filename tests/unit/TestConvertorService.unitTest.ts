import "reflect-metadata";

import { TestConvertorService } from "../../src/services/TestConvertorService";
import { CertificateRequestProcessor } from "../../src/functions/CertificateRequestProcessor";

describe('Test Convertor Service', () => {
    describe('isProcessModifyEventsEnabled', () => {
        it('should throw an error when the environment variable is not set to true or false', () => {
            expect.assertions(1)
            process.env.PROCESS_MODIFY_EVENTS = 'lol';

            try {
                TestConvertorService.isProcessModifyEventsEnabled();
            } catch (e) {
                expect((e as Error).message).toBe('PROCESS_MODIFY_EVENTS environment variable must be true or false');
            }
        })
        it('should return false if the variable is set to false', () => {
            process.env.PROCESS_MODIFY_EVENTS = 'false';

            const res = TestConvertorService.isProcessModifyEventsEnabled();

            expect(res).toBeFalsy();
        })
        it('should return true if the variable is set to true', () => {
            process.env.PROCESS_MODIFY_EVENTS = 'true';

            const res = TestConvertorService.isProcessModifyEventsEnabled();

            expect(res).toBeTruthy();
        })
    });

    describe('expandRecords', () => {
        it('should return [] if testTypes is not an array', () => {
            const test = {
                foo: 'bar',
                testTypes: 'not an array'
            }

            const res = TestConvertorService.expandRecords(test);

            expect(res).toStrictEqual([]);
        })
        it('should return array length of one if testTypes has one object', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: 'pass',
                        testTypeClassification: 'Annual With Certificate'
                    }
                ]
            }

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toStrictEqual(1);
            expect((res[0].testTypes as any).object1).toBe('value1')
            expect((res[0] as any).foo).toBe('bar')
        })
        it('should return array length of two if testTypes has two objects', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: 'prs',
                        testTypeClassification: 'Annual With Certificate'
                    },
                    {
                        object2: 'value2',
                        testResult: 'fail',
                        testTypeClassification: 'IVA With Certificate',
                        requiredStandards: ['this is one', 'this is two']
                    },
                ]
            }

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toStrictEqual(2);
            expect((res[0] as any).testTypes.object1).toBe('value1')
            expect((res[1] as any).testTypes.object2).toBe('value2')
            expect((res[0] as any).foo).toBe('bar')
            expect((res[1] as any).foo).toBe('bar')
        })
        it('should return array length of three if testTypes has three objects', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: 'fail',
                        testTypeClassification: 'Annual With Certificate'
                    },
                    {
                        object2: 'value2',
                        testResult: 'fail',
                        testTypeClassification: 'IVA With Certificate',
                        requiredStandards: ['this is one', 'this is two']
                    },
                    {
                        object3: 'value3',
                        testResult: 'fail',
                        testTypeClassification: 'MSVA With Certificate',
                        requiredStandards: ['this is one', 'this is two']
                    },
                ]
            }

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toBe(3);
            expect((res[0] as any).testTypes.object1).toBe('value1')
            expect((res[1] as any).testTypes.object2).toBe('value2')
            expect((res[2] as any).testTypes.object3).toBe('value3')
            expect((res[0] as any).foo).toBe('bar')
            expect((res[1] as any).foo).toBe('bar')
            expect((res[2] as any).foo).toBe('bar')
        })
        it('should return an array length of 1 if testTypes has three objects, but only one correct test types', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: 'fail',
                        testTypeClassification: 'Bad test class'
                    },
                    {
                        object2: 'value2',
                        testResult: 'fail',
                        testTypeClassification: 'Not a test class'
                    },
                    {
                        object3: 'value3',
                        testResult: 'pass',
                        testTypeClassification: 'Annual With Certificate'
                    },
                ]
            }

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toBe(1);
            expect((res[0] as any).testTypes.object3).toBe('value3')
            expect((res[0] as any).foo).toBe('bar')
        })
        it('should return an array length of 1 if testTypes has three objects with IVA, but only one with required standards', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: 'fail',
                        testTypeClassification: 'IVA With Certificate',
                        requiredStandards: ['this is one', 'this is two']
                    },
                    {
                        object2: 'value2',
                        testResult: 'fail',
                        testTypeClassification: 'IVA With Certificate',
                    },
                    {
                        object3: 'value3',
                        testResult: 'pass',
                        testTypeClassification: 'MSVA With Certificate',
                    },
                ]
            }

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toBe(1);
            expect((res[0] as any).testTypes.object1).toBe('value1')
            expect((res[0] as any).foo).toBe('bar')
        })
        it('should return an array length 1 if testTypes has 1 object that is abandoned and has valid testTypeId', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: "abandoned",
                        testTypeId: "1",
                        testTypeClassification: 'Annual Test',
                    }
                ]
            }

            const spy = jest.spyOn(TestConvertorService, 'shouldGenerateAbandonedCerts').mockReturnValue(true);

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toBe(1);

            spy.mockRestore();
        });
        it('should return an array length 0 if testTypes has 1 object that is abandoned and has invalid testTypeId', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: "abandoned",
                        testTypeId: "0",
                        testTypeClassification: 'Annual Test',
                    }
                ]
            }

            const spy = jest.spyOn(TestConvertorService, 'shouldGenerateAbandonedCerts').mockReturnValue(true);

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toBe(0);

            spy.mockRestore();
        });
        it('should return an array length 0 if testTypes has 1 object that is abandoned and has valid testTypeId but flag is off', () => {
            const test = {
                foo: 'bar',
                testStatus: 'submitted',
                testTypes: [
                    {
                        object1: 'value1',
                        testResult: "abandoned",
                        testTypeId: "1",
                        testTypeClassification: 'Annual Test',
                    }
                ]
            }

            const spy = jest.spyOn(TestConvertorService, 'shouldGenerateAbandonedCerts').mockReturnValue(false);

            const res = TestConvertorService.expandRecords(test);

            expect(res.length).toBe(0);

            spy.mockRestore();
        });
    });

    describe('shouldGenerateAbandonedCerts', () => {
        it('should return true if flag is enabled', () => {
            CertificateRequestProcessor.flags = {
                welshTranslation: {
                    enabled: true,
                    translatePassTestResult: true,
                    translatePrsTestResult: true,
                    translateFailTestResult: true,
                },
                abandonedCerts: {
                    enabled: true,
                },
            };
            const result = TestConvertorService.shouldGenerateAbandonedCerts();
            expect(result).toBeTruthy();
        });
        it('should return false if flag is disabled', () => {
            CertificateRequestProcessor.flags = {
                welshTranslation: {
                    enabled: true,
                    translatePassTestResult: true,
                    translatePrsTestResult: true,
                    translateFailTestResult: true,
                },
                abandonedCerts: {
                    enabled: false,
                },
            };
            const result = TestConvertorService.shouldGenerateAbandonedCerts();
            expect(result).toBeFalsy();
        });
    });
})
