const mockUnmarshall = jest.fn();

import { SQSRecord } from "aws-lambda";
import 'reflect-metadata';
import { CertificateRequestProcessor } from "../../src/functions/CertificateRequestProcessor";
import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import { CertificateUploadService } from "../../src/services/CertificateUploadService";
import { TestConvertorService } from "../../src/services/TestConvertorService";


jest.mock('@aws-sdk/util-dynamodb', () => ({
    unmarshall: mockUnmarshall,
}))

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
        })
        it('should not call expand records when event is modify and PROCESS_MODIFY_EVENTS is false', async () => {
            process.env.PROCESS_MODIFY_EVENTS = 'false';
            const record = {
                body: JSON.stringify({eventName: "MODIFY"})
            } as unknown as SQSRecord

            const res = await certReqProcessor.preProcessPayload(record);
            
            expect(res).toStrictEqual([]);
        })
        it('should not call expand records when event has no new dynamoDb image', async () => {
            const record = {
                body: JSON.stringify({eventName: "INSERT", dynamodb: { badVariable: {} }})
            } as unknown as SQSRecord

            const res = await certReqProcessor.preProcessPayload(record);
            
            expect(res).toStrictEqual([]);
        })
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
        })
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
        })
    });
})