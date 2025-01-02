import 'reflect-metadata';

const mockUnmarshall = jest.fn();

import { SQSRecord } from "aws-lambda";
import { CertificateRequestProcessor } from "../../src/functions/CertificateRequestProcessor";
import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import { CertificateUploadService } from "../../src/services/CertificateUploadService";
import { TestConvertorService } from "../../src/services/TestConvertorService";
import { getProfile } from "@dvsa/cvs-feature-flags/profiles/vtx";

jest.mock('@aws-sdk/util-dynamodb', () => ({
    unmarshall: mockUnmarshall,
}));

jest.mock('@dvsa/cvs-feature-flags/profiles/vtx', () => ({
    getProfile: jest.fn()
}));

describe('Certificate Request Processor', () => {

    const certReqProcessor = new CertificateRequestProcessor(jest.fn() as unknown as CertificateGenerationService,
     jest.fn() as unknown as CertificateUploadService);

    describe('preProcessPayload', () => {
        it('should not call expand records when event is not insert or modify', async () => {
            const record = {
                body: JSON.stringify({eventName: "BAD"})
            } as unknown as SQSRecord

            const res = await certReqProcessor.preProcessPayload(record);

            expect(res).toStrictEqual([]);
        });
        it('should not call expand records when event is modify and PROCESS_MODIFY_EVENTS is false', async () => {
            process.env.PROCESS_MODIFY_EVENTS = 'false';
            const record = {
                body: JSON.stringify({eventName: "MODIFY"})
            } as unknown as SQSRecord

            const res = await certReqProcessor.preProcessPayload(record);

            expect(res).toStrictEqual([]);
        });
        it('should not call expand records when event has no new dynamoDb image', async () => {
            const record = {
                body: JSON.stringify({eventName: "INSERT", dynamodb: { badVariable: {} }})
            } as unknown as SQSRecord

            const res = await certReqProcessor.preProcessPayload(record);

            expect(res).toStrictEqual([]);
        });
        it('should call expand records when event is modify and PROCESS_MODIFY_EVENTS is true', async () => {
            process.env.PROCESS_MODIFY_EVENTS = 'true';
            const record = {
                body: JSON.stringify({eventName: "MODIFY", dynamodb: { NewImage: { foo: 'bar' } }})
            } as unknown as SQSRecord

            const spy = jest.spyOn(TestConvertorService as any, 'expandRecords').mockImplementation(() => {
                return [];
            })

            await certReqProcessor.preProcessPayload(record);

            expect(spy).toHaveBeenCalled();
        });
        it('should call expand records when event is insert and PROCESS_MODIFY_EVENTS is true', async () => {
            process.env.PROCESS_MODIFY_EVENTS = 'true';
            const record = {
                body: JSON.stringify({eventName: "INSERT", dynamodb: { NewImage: { foo: 'bar' } }})
            } as unknown as SQSRecord

            const spy = jest.spyOn(TestConvertorService as any, 'expandRecords').mockImplementation(() => {
                return [];
            })

            await certReqProcessor.preProcessPayload(record);

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('retrieveAndSetFlags', () => {
        it('should set flags if not already set', async () => {
            const mockFlags = {
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
            (getProfile as jest.Mock).mockResolvedValue(mockFlags);

            const logSpy = jest.spyOn(console, "log");

            await certReqProcessor.retrieveAndSetFlags();

            expect(getProfile).toHaveBeenCalled();
            expect(CertificateRequestProcessor.flags).toEqual(mockFlags);
            expect(logSpy).toHaveBeenCalledWith(`Feature flag cache not set, retrieving feature flags`);
            jest.clearAllMocks();
            logSpy.mockClear();
        });
        it('should not call getProfile if flags are already set', async () => {
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

            const logSpy = jest.spyOn(console, "log");

            await certReqProcessor.retrieveAndSetFlags();

            expect(getProfile).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith(`Feature flag cache already set`, CertificateRequestProcessor.flags);
            jest.clearAllMocks();
            logSpy.mockClear();
        });
        it('should log an error if there is an issue retrieving flags', async () => {
            // @ts-ignore
            CertificateRequestProcessor.flags = undefined
            const errorMock = new Error('error');
            (getProfile as jest.Mock).mockRejectedValue(errorMock);

            const logSpy = jest.spyOn(console, "log");
            const errorSpy = jest.spyOn(console, "error");

            await certReqProcessor.retrieveAndSetFlags();

            expect(logSpy).toHaveBeenCalledWith(`Feature flag cache not set, retrieving feature flags`);
            expect(errorSpy).toHaveBeenCalledWith(`Failed to retrieve feature flags - ${errorMock}`);
            jest.clearAllMocks();
            logSpy.mockClear();
            errorSpy.mockClear();
        });
    });
})
