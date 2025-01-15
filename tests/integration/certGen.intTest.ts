import 'reflect-metadata';

import { SQSBatchResponse } from 'aws-lambda';
import lambdaTester from "lambda-tester";
import sinon from "sinon";
import { Container } from 'typedi';
import { certGen } from "../../src/functions/certGen";
import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import { CertificateUploadService } from "../../src/services/CertificateUploadService";
import { LambdaService } from "../../src/services/LambdaService";
import { S3BucketService } from "../../src/services/S3BucketService";
import { LambdaMockService } from "../models/LambdaMockService";
import { S3BucketMockService } from "../models/S3BucketMockService";
import { payloads } from "./payloads.json";
// tslint:disable:max-line-length

describe("Invoke certGen Function", () => {
  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });
  context("when the certGen function is invoked with valid test result", () => {
    const lambda = lambdaTester(certGen);
    const payload: any = {
      Records: [
        {
          messageId: "h48c54a0-7027-4e37-b7e8-c8d231511c89",
          receiptHandle:
            "AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==",
          body: payloads[0].body,
          messageAttributes: {},
          md5OfBody: "9586727cbc9f3312542387099b60982c",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:eu-west-2:006106226016:cert-gen-q",
          awsRegion: "eu-west-2",
        },
      ],
    };

    it("should invoke certificate generate and upload services once", () => {
      // Stub CertificateGenerationService generateCertificate method and resolve it
      const certGenServiceStub = sandbox
        .stub(CertificateGenerationService.prototype, "generateCertificate")
        .resolvesThis();
      // Stub CertificateUploadService uploadCertificate method and resolve it
      const certUploadServiceStub = sandbox
        .stub(CertificateUploadService.prototype, "uploadCertificate")
        .resolvesThis();

      return lambda.event(payload).expectResolve((response: SQSBatchResponse) => {
        expect(response.batchItemFailures.length).toBe(0);
        sinon.assert.callCount(certGenServiceStub, 1);
        sinon.assert.callCount(certUploadServiceStub, 1);
        certGenServiceStub.restore();
        certUploadServiceStub.restore();
      });
    });
  });

  context(
    "when the certGen function is invoked with retroKey flag is set to false at test level in test results",
    () => {
      const lambda = lambdaTester(certGen);
      const payload: any = {
        Records: [
          {
            messageId: "h48c54a0-7027-4e37-b7e8-c8d231511c89",
            receiptHandle:
              "AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==",
            body: payloads[1].body,
            messageAttributes: {},
            md5OfBody: "9586727cbc9f3312542387099b60982c",
            eventSource: "aws:sqs",
            eventSourceARN: "arn:aws:sqs:eu-west-2:006106226016:cert-gen-q",
            awsRegion: "eu-west-2",
          },
        ],
      };

      it("should invoke certificate generate and upload services", () => {
        // Stub CertificateGenerationService generateCertificate method
        const certGenServiceStub = sandbox
          .stub(CertificateGenerationService.prototype, "generateCertificate")
          .resolvesThis();
        // Stub CertificateUploadService uploadCertificate method
        const certUploadServiceStub = sandbox
          .stub(CertificateUploadService.prototype, "uploadCertificate")
          .resolvesThis();

        return lambda.event(payload).expectResolve((response: SQSBatchResponse) => {
          expect(response.batchItemFailures.length).toBe(0);
          sinon.assert.callCount(certGenServiceStub, 1);
          sinon.assert.callCount(certUploadServiceStub, 1);
          certGenServiceStub.restore();
          certUploadServiceStub.restore();
        });
      });
    }
  );

  context(
    "when the certGen function is invoked with cvsTestUpdated flag is set to false at test-type level in test results",
    () => {
      const lambda = lambdaTester(certGen);
      const payload: any = {
        Records: [
          {
            messageId: "h48c54a0-7027-4e37-b7e8-c8d231511c89",
            receiptHandle:
              "AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==",
            body: payloads[2].body,
            messageAttributes: {},
            md5OfBody: "9586727cbc9f3312542387099b60982c",
            eventSource: "aws:sqs",
            eventSourceARN: "arn:aws:sqs:eu-west-2:006106226016:cert-gen-q",
            awsRegion: "eu-west-2",
          },
        ],
      };

      it("should invoke certificate generate and upload services", () => {
        // Stub CertificateGenerationService generateCertificate method
        const certGenServiceStub = sandbox
          .stub(CertificateGenerationService.prototype, "generateCertificate")
          .resolvesThis();
        // Stub CertificateUploadService uploadCertificate method
        const certUploadServiceStub = sandbox
          .stub(CertificateUploadService.prototype, "uploadCertificate")
          .resolvesThis();

        return lambda.event(payload).expectResolve((response: SQSBatchResponse) => {
          expect(response.batchItemFailures.length).toBe(0);
          sinon.assert.callCount(certGenServiceStub, 1);
          sinon.assert.callCount(certUploadServiceStub, 1);
          certGenServiceStub.restore();
          certUploadServiceStub.restore();
        });
      });
    }
  );

  context(
    "when the certGen function is invoked with invalid testResultId for certificate generation.",
    () => {
      const lambda = lambdaTester(certGen);
      const payload: any = {
        Records: [
          {
            messageId: "h48c54a0-7027-4e37-b7e8-c8d231511c89",
            receiptHandle:
              "AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==",
            body: payloads[3].body,
            messageAttributes: {},
            md5OfBody: "9586727cbc9f3312542387099b60982c",
            eventSource: "aws:sqs",
            eventSourceARN: "arn:aws:sqs:eu-west-2:006106226016:cert-gen-q",
            awsRegion: "eu-west-2",
          },
        ],
      };

      it("should not invoke certificate generate and upload services", () => {
        // Stub CertificateGenerationService generateCertificate method
        const certGenServiceStub = sandbox.stub(
          CertificateGenerationService.prototype,
          "generateCertificate"
        );
        // Stub CertificateUploadService uploadCertificate method
        const certUploadServiceStub = sandbox.stub(
          CertificateUploadService.prototype,
          "uploadCertificate"
        );

        return lambda.event(payload).expectResolve((response: SQSBatchResponse) => {
          expect(response.batchItemFailures.length).toBe(1);
          sinon.assert.callCount(certGenServiceStub, 0);
          sinon.assert.callCount(certUploadServiceStub, 0);
          certGenServiceStub.restore();
          certUploadServiceStub.restore();
        });
      });
    }
  );
});
