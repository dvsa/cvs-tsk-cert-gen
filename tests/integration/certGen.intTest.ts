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
          body: "{\n  \"eventID\": \"c4ca4238a0b923820dcc509a6f75849b\",\n  \"eventName\": \"INSERT\",\n  \"eventVersion\": \"1.1\",\n  \"eventSource\": \"aws:dynamodb\",\n  \"awsRegion\": \"us-east-1\",\n  \"dynamodb\": {\n    \"Keys\": {\n      \"Id\": {\n        \"N\": \"101\"\n      }\n    },\n    \"NewImage\": {\n \"testerStaffId\": {\n  \"S\": \"1\"\n },\n \"testStartTimestamp\": {\n  \"S\": \"2019-02-26T14:50:44.279Z\"\n },\n \"odometerReadingUnits\": {\n  \"S\": \"kilometres\"\n },\n \"testEndTimestamp\": {\n  \"S\": \"2019-02-26T15:02:10.761Z\"\n },\n \"testStatus\": {\n  \"S\": \"submitted\"\n },\n \"testTypes\": {\n  \"L\": [\n   {\n    \"M\": {\n     \"testNumber\": {\n      \"S\": \"W01A00310\"\n     },\n     \"prohibitionIssued\": {\n      \"BOOL\": false\n     },\n     \"testCode\": {\n      \"S\": \"aas\"\n     },\n     \"lastUpdatedAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"numberOfSeatbeltsFitted\": {\n      \"N\": \"2\"\n     },\n     \"testTypeEndTimestamp\": {\n      \"S\": \"2019-02-26T15:02:37.392Z\"\n     },\n     \"lastSeatbeltInstallationCheckDate\": {\n      \"S\": \"2019-02-26\"\n     },\n     \"createdAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"testTypeId\": {\n      \"S\": \"1\"\n     },\n     \"testTypeStartTimestamp\": {\n      \"S\": \"2019-02-26T14:51:54.180Z\"\n     },\n     \"certificateNumber\": {\n      \"S\": \"321\"\n     },\n     \"seatbeltInstallationCheckDate\": {\n      \"BOOL\": true\n     },\n     \"testTypeName\": {\n      \"S\": \"Annual test\"\n     },\n     \"defects\": {\n      \"L\": [\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"dangerous\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"not working correctly and obviously affects steering control.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Asdasd\"\n           },\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"inner\"\n             },\n             \"lateral\": {\n              \"S\": \"offside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.a.ii\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"ii\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"a\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"minor\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"reservoir is below minimum level.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"outer\"\n             },\n             \"lateral\": {\n              \"S\": \"nearside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.d.i\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"i\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"d\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"advisory\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"null\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Dasdasdccc\"\n           },\n           \"location\": {\n            \"M\": {}\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"5.1\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"NULL\": true\n         },\n         \"deficiencyId\": {\n          \"NULL\": true\n         },\n         \"imDescription\": {\n          \"S\": \"Exhaust Emissions\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Compression Ignition Engines Statutory Smoke Meter Test:\"\n         },\n         \"imNumber\": {\n          \"N\": \"5\"\n         }\n        }\n       }\n      ]\n     },\n     \"name\": {\n      \"S\": \"Annual test\"\n     },\n     \"testResult\": {\n      \"S\": \"fail\"\n     }\n    }\n   }\n  ]\n },\n \"vehicleClass\": {\n  \"M\": {\n   \"code\": {\n    \"S\": \"s\"\n   },\n   \"description\": {\n    \"S\": \"small psv (ie: less than or equal to 22 seats)\"\n   }\n  }\n },\n \"testResultId\": {\n  \"S\": \"2bed0f4f-5ab2-499b-98ce-c0b4bc1a3f7f\"\n },\n \"vehicleSize\": {\n  \"S\": \"small\"\n },\n \"vin\": {\n  \"S\": \"XMGDE02FS0H012345\"\n },\n \"testStationName\": {\n  \"S\": \"Abshire-Kub\"\n },\n \"vehicleId\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"countryOfRegistration\": {\n  \"S\": \"gb\"\n },\n \"vehicleType\": {\n  \"S\": \"psv\"\n },\n \"preparerId\": {\n  \"S\": \"AK4434\"\n },\n \"preparerName\": {\n  \"S\": \"Durrell Vehicles Limited\"\n },\n \"odometerReading\": {\n  \"N\": \"12312\"\n },\n \"vehicleConfiguration\": {\n  \"S\": \"rigid\"\n },\n \"testStationType\": {\n  \"S\": \"gvts\"\n },\n \"testerName\": {\n  \"S\": \"CVS Dev1\"\n },\n \"vrm\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"testStationPNumber\": {\n  \"S\": \"09-4129632\"\n },\n \"numberOfSeats\": {\n  \"N\": \"50\"\n },\n \"testerEmailAddress\": {\n  \"S\": \"cvs.dev1@dvsagov.onmicrosoft.com\"\n },\n \"euVehicleCategory\": {\n  \"S\": \"m1\"\n },\n \"order\": {\n  \"M\": {\n   \"current\": {\n    \"N\": \"2\"\n   },\n   \"total\": {\n    \"N\": \"2\"\n   }\n  }\n }\n},\n    \"ApproximateCreationDateTime\": 1428537600,\n    \"SequenceNumber\": \"4421584500000000017450439091\",\n    \"SizeBytes\": 26,\n    \"StreamViewType\": \"NEW_AND_OLD_IMAGES\"\n  },\n  \"eventSourceARN\": \"arn:aws:dynamodb:us-east-1:123456789012:table/ExampleTableWithStream/stream/2015-06-27T00:48:05.899\"\n}",
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
            body: "{\n  \"eventID\": \"c4ca4238a0b923820dcc509a6f75849b\",\n  \"eventName\": \"INSERT\",\n  \"eventVersion\": \"1.1\",\n  \"eventSource\": \"aws:dynamodb\",\n  \"awsRegion\": \"us-east-1\",\n  \"dynamodb\": {\n    \"Keys\": {\n      \"Id\": {\n        \"N\": \"101\"\n      }\n    },\n    \"NewImage\": {\n \"testerStaffId\": {\n  \"S\": \"1\"\n },\n \"testStartTimestamp\": {\n  \"S\": \"2019-02-26T14:50:44.279Z\"\n },\n \"odometerReadingUnits\": {\n  \"S\": \"kilometres\"\n },\n \"testEndTimestamp\": {\n  \"S\": \"2019-02-26T15:02:10.761Z\"\n },\n \"testStatus\": {\n  \"S\": \"submitted\"\n },\n \"retroError\": {\n  \"BOOL\": false\n },\n \"testTypes\": {\n  \"L\": [\n   {\n    \"M\": {\n     \"testNumber\": {\n      \"S\": \"W01A00310\"\n     },\n     \"prohibitionIssued\": {\n      \"BOOL\": false\n     },\n     \"testCode\": {\n      \"S\": \"aas\"\n     },\n     \"lastUpdatedAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"numberOfSeatbeltsFitted\": {\n      \"N\": \"2\"\n     },\n     \"testTypeEndTimestamp\": {\n      \"S\": \"2019-02-26T15:02:37.392Z\"\n     },\n     \"lastSeatbeltInstallationCheckDate\": {\n      \"S\": \"2019-02-26\"\n     },\n     \"createdAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"testTypeId\": {\n      \"S\": \"1\"\n     },\n     \"testTypeStartTimestamp\": {\n      \"S\": \"2019-02-26T14:51:54.180Z\"\n     },\n     \"certificateNumber\": {\n      \"S\": \"321\"\n     },\n     \"seatbeltInstallationCheckDate\": {\n      \"BOOL\": true\n     },\n     \"testTypeName\": {\n      \"S\": \"Annual test\"\n     },\n     \"defects\": {\n      \"L\": [\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"dangerous\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"not working correctly and obviously affects steering control.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Asdasd\"\n           },\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"inner\"\n             },\n             \"lateral\": {\n              \"S\": \"offside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.a.ii\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"ii\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"a\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"minor\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"reservoir is below minimum level.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"outer\"\n             },\n             \"lateral\": {\n              \"S\": \"nearside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.d.i\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"i\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"d\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"advisory\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"null\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Dasdasdccc\"\n           },\n           \"location\": {\n            \"M\": {}\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"5.1\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"NULL\": true\n         },\n         \"deficiencyId\": {\n          \"NULL\": true\n         },\n         \"imDescription\": {\n          \"S\": \"Exhaust Emissions\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Compression Ignition Engines Statutory Smoke Meter Test:\"\n         },\n         \"imNumber\": {\n          \"N\": \"5\"\n         }\n        }\n       }\n      ]\n     },\n     \"name\": {\n      \"S\": \"Annual test\"\n     },\n     \"testResult\": {\n      \"S\": \"fail\"\n     }\n    }\n   }\n  ]\n },\n \"vehicleClass\": {\n  \"M\": {\n   \"code\": {\n    \"S\": \"s\"\n   },\n   \"description\": {\n    \"S\": \"small psv (ie: less than or equal to 22 seats)\"\n   }\n  }\n },\n \"testResultId\": {\n  \"S\": \"2bed0f4f-5ab2-499b-98ce-c0b4bc1a3f7f\"\n },\n \"vehicleSize\": {\n  \"S\": \"small\"\n },\n \"vin\": {\n  \"S\": \"XMGDE02FS0H012345\"\n },\n \"testStationName\": {\n  \"S\": \"Abshire-Kub\"\n },\n \"vehicleId\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"countryOfRegistration\": {\n  \"S\": \"gb\"\n },\n \"vehicleType\": {\n  \"S\": \"psv\"\n },\n \"preparerId\": {\n  \"S\": \"AK4434\"\n },\n \"preparerName\": {\n  \"S\": \"Durrell Vehicles Limited\"\n },\n \"odometerReading\": {\n  \"N\": \"12312\"\n },\n \"vehicleConfiguration\": {\n  \"S\": \"rigid\"\n },\n \"testStationType\": {\n  \"S\": \"gvts\"\n },\n \"testerName\": {\n  \"S\": \"CVS Dev1\"\n },\n \"vrm\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"testStationPNumber\": {\n  \"S\": \"09-4129632\"\n },\n \"numberOfSeats\": {\n  \"N\": \"50\"\n },\n \"testerEmailAddress\": {\n  \"S\": \"cvs.dev1@dvsagov.onmicrosoft.com\"\n },\n \"euVehicleCategory\": {\n  \"S\": \"m1\"\n },\n \"order\": {\n  \"M\": {\n   \"current\": {\n    \"N\": \"2\"\n   },\n   \"total\": {\n    \"N\": \"2\"\n   }\n  }\n }\n},\n    \"ApproximateCreationDateTime\": 1428537600,\n    \"SequenceNumber\": \"4421584500000000017450439091\",\n    \"SizeBytes\": 26,\n    \"StreamViewType\": \"NEW_AND_OLD_IMAGES\"\n  },\n  \"eventSourceARN\": \"arn:aws:dynamodb:us-east-1:123456789012:table/ExampleTableWithStream/stream/2015-06-27T00:48:05.899\"\n}",
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
            body: "{\n  \"eventID\": \"c4ca4238a0b923820dcc509a6f75849b\",\n  \"eventName\": \"INSERT\",\n  \"eventVersion\": \"1.1\",\n  \"eventSource\": \"aws:dynamodb\",\n  \"awsRegion\": \"us-east-1\",\n  \"dynamodb\": {\n    \"Keys\": {\n      \"Id\": {\n        \"N\": \"101\"\n      }\n    },\n    \"NewImage\": {\n \"testerStaffId\": {\n  \"S\": \"1\"\n },\n \"testStartTimestamp\": {\n  \"S\": \"2019-02-26T14:50:44.279Z\"\n },\n \"odometerReadingUnits\": {\n  \"S\": \"kilometres\"\n },\n \"testEndTimestamp\": {\n  \"S\": \"2019-02-26T15:02:10.761Z\"\n },\n \"testStatus\": {\n  \"S\": \"submitted\"\n },\n \"testTypes\": {\n  \"L\": [\n   {\n    \"M\": {\n     \"testNumber\": {\n      \"S\": \"W01A00310\"\n     },\n     \"prohibitionIssued\": {\n      \"BOOL\": false\n     },\n     \"cvsTestUpdated\": {\n      \"BOOL\": false\n     },\n     \"testCode\": {\n      \"S\": \"aas\"\n     },\n     \"lastUpdatedAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"numberOfSeatbeltsFitted\": {\n      \"N\": \"2\"\n     },\n     \"testTypeEndTimestamp\": {\n      \"S\": \"2019-02-26T15:02:37.392Z\"\n     },\n     \"lastSeatbeltInstallationCheckDate\": {\n      \"S\": \"2019-02-26\"\n     },\n     \"createdAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"testTypeId\": {\n      \"S\": \"1\"\n     },\n     \"testTypeStartTimestamp\": {\n      \"S\": \"2019-02-26T14:51:54.180Z\"\n     },\n     \"certificateNumber\": {\n      \"S\": \"321\"\n     },\n     \"seatbeltInstallationCheckDate\": {\n      \"BOOL\": true\n     },\n     \"testTypeName\": {\n      \"S\": \"Annual test\"\n     },\n     \"defects\": {\n      \"L\": [\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"dangerous\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"not working correctly and obviously affects steering control.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Asdasd\"\n           },\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"inner\"\n             },\n             \"lateral\": {\n              \"S\": \"offside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.a.ii\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"ii\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"a\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"minor\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"reservoir is below minimum level.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"outer\"\n             },\n             \"lateral\": {\n              \"S\": \"nearside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.d.i\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"i\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"d\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"advisory\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"null\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Dasdasdccc\"\n           },\n           \"location\": {\n            \"M\": {}\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"5.1\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"NULL\": true\n         },\n         \"deficiencyId\": {\n          \"NULL\": true\n         },\n         \"imDescription\": {\n          \"S\": \"Exhaust Emissions\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Compression Ignition Engines Statutory Smoke Meter Test:\"\n         },\n         \"imNumber\": {\n          \"N\": \"5\"\n         }\n        }\n       }\n      ]\n     },\n     \"name\": {\n      \"S\": \"Annual test\"\n     },\n     \"testResult\": {\n      \"S\": \"fail\"\n     }\n    }\n   }\n  ]\n },\n \"vehicleClass\": {\n  \"M\": {\n   \"code\": {\n    \"S\": \"s\"\n   },\n   \"description\": {\n    \"S\": \"small psv (ie: less than or equal to 22 seats)\"\n   }\n  }\n },\n \"testResultId\": {\n  \"S\": \"2bed0f4f-5ab2-499b-98ce-c0b4bc1a3f7f\"\n },\n \"vehicleSize\": {\n  \"S\": \"small\"\n },\n \"vin\": {\n  \"S\": \"XMGDE02FS0H012345\"\n },\n \"testStationName\": {\n  \"S\": \"Abshire-Kub\"\n },\n \"vehicleId\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"countryOfRegistration\": {\n  \"S\": \"gb\"\n },\n \"vehicleType\": {\n  \"S\": \"psv\"\n },\n \"preparerId\": {\n  \"S\": \"AK4434\"\n },\n \"preparerName\": {\n  \"S\": \"Durrell Vehicles Limited\"\n },\n \"odometerReading\": {\n  \"N\": \"12312\"\n },\n \"vehicleConfiguration\": {\n  \"S\": \"rigid\"\n },\n \"testStationType\": {\n  \"S\": \"gvts\"\n },\n \"testerName\": {\n  \"S\": \"CVS Dev1\"\n },\n \"vrm\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"testStationPNumber\": {\n  \"S\": \"09-4129632\"\n },\n \"numberOfSeats\": {\n  \"N\": \"50\"\n },\n \"testerEmailAddress\": {\n  \"S\": \"cvs.dev1@dvsagov.onmicrosoft.com\"\n },\n \"euVehicleCategory\": {\n  \"S\": \"m1\"\n },\n \"order\": {\n  \"M\": {\n   \"current\": {\n    \"N\": \"2\"\n   },\n   \"total\": {\n    \"N\": \"2\"\n   }\n  }\n }\n},\n    \"ApproximateCreationDateTime\": 1428537600,\n    \"SequenceNumber\": \"4421584500000000017450439091\",\n    \"SizeBytes\": 26,\n    \"StreamViewType\": \"NEW_AND_OLD_IMAGES\"\n  },\n  \"eventSourceARN\": \"arn:aws:dynamodb:us-east-1:123456789012:table/ExampleTableWithStream/stream/2015-06-27T00:48:05.899\"\n}",
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
            body: "{\n  \"eventID\": \"c4ca4238a0b923820dcc509a6f75849b\",\n  \"eventName\": \"INSERT\",\n  \"eventVersion\": \"1.1\",\n  \"eventSource\": \"aws:dynamodb\",\n  \"awsRegion\": \"us-east-1\",\n  \"dynamodb\": {\n    \"Keys\": {\n      \"Id\": {\n        \"N\": \"101\"\n      }\n    },\n    \"NewImage\": {\n \"testerStaffId\": {\n  \"S\": \"1\"\n },\n \"testStartTimestamp\": {\n  \"S\": \"2019-02-26T14:50:44.279Z\"\n },\n \"odometerReadingUnits\": {\n  \"S\": \"kilometres\"\n },\n \"testEndTimestamp\": {\n  \"S\": \"2019-02-26T15:02:10.761Z\"\n },\n \"testStatus\": {\n  \"S\": \"submitted\"\n },\n \"testTypes\": {\n  \"L\": [\n   {\n    \"M\": {\n     \"testNumber\": {\n      \"S\": \"W01A00310\"\n     },\n     \"prohibitionIssued\": {\n      \"BOOL\": false\n     },\n     \"cvsTestUpdated\": {\n      \"BOOL\": false\n     },\n     \"testCode\": {\n      \"S\": \"aas\"\n     },\n     \"lastUpdatedAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"numberOfSeatbeltsFitted\": {\n      \"N\": \"2\"\n     },\n     \"testTypeEndTimestamp\": {\n      \"S\": \"2019-02-26T15:02:37.392Z\"\n     },\n     \"lastSeatbeltInstallationCheckDate\": {\n      \"S\": \"2019-02-26\"\n     },\n     \"createdAt\": {\n      \"S\": \"2019-02-26T15:29:39.537Z\"\n     },\n     \"testTypeId\": {\n      \"S\": \"1\"\n     },\n     \"testTypeStartTimestamp\": {\n      \"S\": \"2019-02-26T14:51:54.180Z\"\n     },\n     \"certificateNumber\": {\n      \"S\": \"321\"\n     },\n     \"seatbeltInstallationCheckDate\": {\n      \"BOOL\": true\n     },\n     \"testTypeName\": {\n      \"S\": \"Annual test\"\n     },\n     \"defects\": {\n      \"L\": [\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"dangerous\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"not working correctly and obviously affects steering control.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Asdasd\"\n           },\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"inner\"\n             },\n             \"lateral\": {\n              \"S\": \"offside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.a.ii\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"ii\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"a\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"minor\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"reservoir is below minimum level.\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"location\": {\n            \"M\": {\n             \"axleNumber\": {\n              \"N\": \"7\"\n             },\n             \"horizontal\": {\n              \"S\": \"outer\"\n             },\n             \"lateral\": {\n              \"S\": \"nearside\"\n             }\n            }\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"54.1.d.i\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"S\": \"i\"\n         },\n         \"deficiencyId\": {\n          \"S\": \"d\"\n         },\n         \"imDescription\": {\n          \"S\": \"Steering\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Power steering:\"\n         },\n         \"imNumber\": {\n          \"N\": \"54\"\n         }\n        }\n       },\n       {\n        \"M\": {\n         \"deficiencyCategory\": {\n          \"S\": \"advisory\"\n         },\n         \"deficiencyText\": {\n          \"S\": \"null\"\n         },\n         \"prs\": {\n          \"BOOL\": false\n         },\n         \"additionalInformation\": {\n          \"M\": {\n           \"notes\": {\n            \"S\": \"Dasdasdccc\"\n           },\n           \"location\": {\n            \"M\": {}\n           }\n          }\n         },\n         \"deficiencyRef\": {\n          \"S\": \"5.1\"\n         },\n         \"itemNumber\": {\n          \"N\": \"1\"\n         },\n         \"stdForProhibition\": {\n          \"BOOL\": false\n         },\n         \"deficiencySubId\": {\n          \"NULL\": true\n         },\n         \"deficiencyId\": {\n          \"NULL\": true\n         },\n         \"imDescription\": {\n          \"S\": \"Exhaust Emissions\"\n         },\n         \"itemDescription\": {\n          \"S\": \"Compression Ignition Engines Statutory Smoke Meter Test:\"\n         },\n         \"imNumber\": {\n          \"N\": \"5\"\n         }\n        }\n       }\n      ]\n     },\n     \"name\": {\n      \"S\": \"Annual test\"\n     },\n     \"testResult\": {\n      \"S\": \"fail\"\n     }\n    }\n   }\n  ]\n },\n \"vehicleClass\": {\n  \"M\": {\n   \"code\": {\n    \"S\": \"s\"\n   },\n   \"description\": {\n    \"S\": \"small psv (ie: less than or equal to 22 seats)\"\n   }\n  }\n },\n \"testResultId\": {\n  \"S\": \"2bed0f4f-5ab2-499b-98ce\"\n },\n \"vehicleSize\": {\n  \"S\": \"small\"\n },\n \"vin\": {\n  \"S\": \"XMGDE02FS0H012345\"\n },\n \"testStationName\": {\n  \"S\": \"Abshire-Kub\"\n },\n \"vehicleId\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"countryOfRegistration\": {\n  \"S\": \"gb\"\n },\n \"vehicleType\": {\n  \"S\": \"psv\"\n },\n \"preparerId\": {\n  \"S\": \"AK4434\"\n },\n \"preparerName\": {\n  \"S\": \"Durrell Vehicles Limited\"\n },\n \"odometerReading\": {\n  \"N\": \"12312\"\n },\n \"vehicleConfiguration\": {\n  \"S\": \"rigid\"\n },\n \"testStationType\": {\n  \"S\": \"gvts\"\n },\n \"testerName\": {\n  \"S\": \"CVS Dev1\"\n },\n \"vrm\": {\n  \"S\": \"BQ91YHQ\"\n },\n \"testStationPNumber\": {\n  \"S\": \"09-4129632\"\n },\n \"numberOfSeats\": {\n  \"N\": \"50\"\n },\n \"testerEmailAddress\": {\n  \"S\": \"cvs.dev1@dvsagov.onmicrosoft.com\"\n },\n \"euVehicleCategory\": {\n  \"S\": \"m1\"\n },\n \"order\": {\n  \"M\": {\n   \"current\": {\n    \"N\": \"2\"\n   },\n   \"total\": {\n    \"N\": \"2\"\n   }\n  }\n }\n},\n    \"ApproximateCreationDateTime\": 1428537600,\n    \"SequenceNumber\": \"4421584500000000017450439091\",\n    \"SizeBytes\": 26,\n    \"StreamViewType\": \"NEW_AND_OLD_IMAGES\"\n  },\n  \"eventSourceARN\": \"arn:aws:dynamodb:us-east-1:123456789012:table/ExampleTableWithStream/stream/2015-06-27T00:48:05.899\"\n}",
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
