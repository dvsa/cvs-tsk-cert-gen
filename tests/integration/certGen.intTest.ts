import 'reflect-metadata';

import Container from 'typedi';
import lambdaTester from 'lambda-tester';
import sinon from 'sinon';
import { CertificateGenerationService } from '../../src/services/CertificateGenerationService';
import { CertificateUploadService } from '../../src/services/CertificateUploadService';
import { certGen } from '../../src/functions/certGen';
import { S3BucketService } from '../../src/services/S3BucketService';
import { LambdaService } from '../../src/services/LambdaService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
// tslint:disable:max-line-length

describe('Invoke certGen Function', () => {
  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
  });
  context('when the certGen function is invoked with valid test result', () => {
    const lambda = lambdaTester(certGen);
    const payload: any = {
      Records: [
        {
          messageId: 'h48c54a0-7027-4e37-b7e8-c8d231511c89',
          receiptHandle:
            'AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==',
          body: '{"testerStaffId":"1","testStartTimestamp":"2019-02-26T14:50:44.279Z","odometerReadingUnits":"kilometres","testEndTimestamp":"2019-02-26T15:02:10.761Z","testStatus":"submitted","testTypes":{"testNumber":"W01A00310","prohibitionIssued":false,"testCode":"aas","lastUpdatedAt":"2019-02-26T15:29:39.537Z","numberOfSeatbeltsFitted":2,"testTypeEndTimestamp":"2019-02-26T15:02:37.392Z","lastSeatbeltInstallationCheckDate":"2019-02-26","createdAt":"2019-02-26T15:29:39.537Z","testTypeId":"1","testTypeStartTimestamp":"2019-02-26T14:51:54.180Z","certificateNumber":"321","seatbeltInstallationCheckDate":true,"testTypeName":"Annual test","defects":[{"deficiencyCategory":"dangerous","deficiencyText":"not working correctly and obviously affects steering control.","prs":false,"additionalInformation":{"notes":"Asdasd","location":{"axleNumber":7,"horizontal":"inner","lateral":"offside"}},"deficiencyRef":"54.1.a.ii","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"ii","deficiencyId":"a","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"minor","deficiencyText":"reservoir is below minimum level.","prs":false,"additionalInformation":{"location":{"axleNumber":7,"horizontal":"outer","lateral":"nearside"}},"deficiencyRef":"54.1.d.i","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"i","deficiencyId":"d","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"advisory","deficiencyText":"null","prs":false,"additionalInformation":{"notes":"Dasdasdccc","location":{}},"deficiencyRef":"5.1","itemNumber":1,"stdForProhibition":false,"deficiencySubId":null,"deficiencyId":null,"imDescription":"Exhaust Emissions","itemDescription":"Compression Ignition Engines Statutory Smoke Meter Test:","imNumber":5}],"name":"Annual test","testResult":"fail"},"vehicleClass":{"code":"s","description":"small psv (ie: less than or equal to 22 seats)"},"testResultId":"2bed0f4f-5ab2-499b-98ce-c0b4bc1a3f7f","vehicleSize":"small","vin":"XMGDE02FS0H012345","testStationName":"Abshire-Kub","vehicleId":"BQ91YHQ","countryOfRegistration":"gb","vehicleType":"psv","preparerId":"AK4434","preparerName":"Durrell Vehicles Limited","odometerReading":12312,"vehicleConfiguration":"rigid","testStationType":"gvts","testerName":"CVS Dev1","vrm":"BQ91YHQ","testStationPNumber":"09-4129632","numberOfSeats":50,"testerEmailAddress":"cvs.dev1@dvsagov.onmicrosoft.com","euVehicleCategory":"m1","order":{"current":2,"total":2}}',
          messageAttributes: {},
          md5OfBody: '9586727cbc9f3312542387099b60982c',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:eu-west-2:006106226016:cert-gen-q',
          awsRegion: 'eu-west-2',
        },
      ],
    };

    it('should invoke certificate generate and upload services once', () => {
      // Stub CertificateGenerationService generateCertificate method and resolve it
      const certGenServiceStub = sandbox
        .stub(CertificateGenerationService.prototype, 'generateCertificate')
        .resolvesThis();
      // Stub CertificateUploadService uploadCertificate method and resolve it
      const certUploadServiceStub = sandbox
        .stub(CertificateUploadService.prototype, 'uploadCertificate')
        .resolvesThis();

      return lambda.event(payload).expectResolve((response: any) => {
        sinon.assert.callCount(certGenServiceStub, 1);
        sinon.assert.callCount(certUploadServiceStub, 1);
        certGenServiceStub.restore();
        certUploadServiceStub.restore();
      });
    });
  });

  context(
    'when the certGen function is invoked with retroKey flag is set to false at test level in test results',
    () => {
      const lambda = lambdaTester(certGen);
      const payload: any = {
        Records: [
          {
            messageId: 'h48c54a0-7027-4e37-b7e8-c8d231511c89',
            receiptHandle:
              'AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==',
            body: '{"testerStaffId":"1","testStartTimestamp":"2019-02-26T14:50:44.279Z","odometerReadingUnits":"kilometres","testEndTimestamp":"2019-02-26T15:02:10.761Z","testStatus":"submitted","retroError":false,"testTypes":{"testNumber":"W01A00310","prohibitionIssued":false,"testCode":"aas","lastUpdatedAt":"2019-02-26T15:29:39.537Z","numberOfSeatbeltsFitted":2,"testTypeEndTimestamp":"2019-02-26T15:02:37.392Z","lastSeatbeltInstallationCheckDate":"2019-02-26","createdAt":"2019-02-26T15:29:39.537Z","testTypeId":"1","testTypeStartTimestamp":"2019-02-26T14:51:54.180Z","certificateNumber":"321","seatbeltInstallationCheckDate":true,"testTypeName":"Annual test","defects":[{"deficiencyCategory":"dangerous","deficiencyText":"not working correctly and obviously affects steering control.","prs":false,"additionalInformation":{"notes":"Asdasd","location":{"axleNumber":7,"horizontal":"inner","lateral":"offside"}},"deficiencyRef":"54.1.a.ii","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"ii","deficiencyId":"a","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"minor","deficiencyText":"reservoir is below minimum level.","prs":false,"additionalInformation":{"location":{"axleNumber":7,"horizontal":"outer","lateral":"nearside"}},"deficiencyRef":"54.1.d.i","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"i","deficiencyId":"d","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"advisory","deficiencyText":"null","prs":false,"additionalInformation":{"notes":"Dasdasdccc","location":{}},"deficiencyRef":"5.1","itemNumber":1,"stdForProhibition":false,"deficiencySubId":null,"deficiencyId":null,"imDescription":"Exhaust Emissions","itemDescription":"Compression Ignition Engines Statutory Smoke Meter Test:","imNumber":5}],"name":"Annual test","testResult":"fail"},"vehicleClass":{"code":"s","description":"small psv (ie: less than or equal to 22 seats)"},"testResultId":"2bed0f4f-5ab2-499b-98ce-c0b4bc1a3f7f","vehicleSize":"small","vin":"XMGDE02FS0H012345","testStationName":"Abshire-Kub","vehicleId":"BQ91YHQ","countryOfRegistration":"gb","vehicleType":"psv","preparerId":"AK4434","preparerName":"Durrell Vehicles Limited","odometerReading":12312,"vehicleConfiguration":"rigid","testStationType":"gvts","testerName":"CVS Dev1","vrm":"BQ91YHQ","testStationPNumber":"09-4129632","numberOfSeats":50,"testerEmailAddress":"cvs.dev1@dvsagov.onmicrosoft.com","euVehicleCategory":"m1","order":{"current":2,"total":2}}',
            messageAttributes: {},
            md5OfBody: '9586727cbc9f3312542387099b60982c',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:eu-west-2:006106226016:cert-gen-q',
            awsRegion: 'eu-west-2',
          },
        ],
      };

      it('should invoke certificate generate and upload services', () => {
        // Stub CertificateGenerationService generateCertificate method
        const certGenServiceStub = sandbox
          .stub(CertificateGenerationService.prototype, 'generateCertificate')
          .resolvesThis();
        // Stub CertificateUploadService uploadCertificate method
        const certUploadServiceStub = sandbox
          .stub(CertificateUploadService.prototype, 'uploadCertificate')
          .resolvesThis();

        return lambda.event(payload).expectResolve((response: any) => {
          sinon.assert.callCount(certGenServiceStub, 1);
          sinon.assert.callCount(certUploadServiceStub, 1);
          certGenServiceStub.restore();
          certUploadServiceStub.restore();
        });
      });
    },
  );

  context(
    'when the certGen function is invoked with cvsTestUpdated flag is set to false at test-type level in test results',
    () => {
      const lambda = lambdaTester(certGen);
      const payload: any = {
        Records: [
          {
            messageId: 'h48c54a0-7027-4e37-b7e8-c8d231511c89',
            receiptHandle:
              'AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==',
            body: '{"testerStaffId":"1","testStartTimestamp":"2019-02-26T14:50:44.279Z","odometerReadingUnits":"kilometres","testEndTimestamp":"2019-02-26T15:02:10.761Z","testStatus":"submitted","testTypes":{"testNumber":"W01A00310","prohibitionIssued":false,"cvsTestUpdated":false,"testCode":"aas","lastUpdatedAt":"2019-02-26T15:29:39.537Z","numberOfSeatbeltsFitted":2,"testTypeEndTimestamp":"2019-02-26T15:02:37.392Z","lastSeatbeltInstallationCheckDate":"2019-02-26","createdAt":"2019-02-26T15:29:39.537Z","testTypeId":"1","testTypeStartTimestamp":"2019-02-26T14:51:54.180Z","certificateNumber":"321","seatbeltInstallationCheckDate":true,"testTypeName":"Annual test","defects":[{"deficiencyCategory":"dangerous","deficiencyText":"not working correctly and obviously affects steering control.","prs":false,"additionalInformation":{"notes":"Asdasd","location":{"axleNumber":7,"horizontal":"inner","lateral":"offside"}},"deficiencyRef":"54.1.a.ii","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"ii","deficiencyId":"a","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"minor","deficiencyText":"reservoir is below minimum level.","prs":false,"additionalInformation":{"location":{"axleNumber":7,"horizontal":"outer","lateral":"nearside"}},"deficiencyRef":"54.1.d.i","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"i","deficiencyId":"d","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"advisory","deficiencyText":"null","prs":false,"additionalInformation":{"notes":"Dasdasdccc","location":{}},"deficiencyRef":"5.1","itemNumber":1,"stdForProhibition":false,"deficiencySubId":null,"deficiencyId":null,"imDescription":"Exhaust Emissions","itemDescription":"Compression Ignition Engines Statutory Smoke Meter Test:","imNumber":5}],"name":"Annual test","testResult":"fail"},"vehicleClass":{"code":"s","description":"small psv (ie: less than or equal to 22 seats)"},"testResultId":"2bed0f4f-5ab2-499b-98ce-c0b4bc1a3f7f","vehicleSize":"small","vin":"XMGDE02FS0H012345","testStationName":"Abshire-Kub","vehicleId":"BQ91YHQ","countryOfRegistration":"gb","vehicleType":"psv","preparerId":"AK4434","preparerName":"Durrell Vehicles Limited","odometerReading":12312,"vehicleConfiguration":"rigid","testStationType":"gvts","testerName":"CVS Dev1","vrm":"BQ91YHQ","testStationPNumber":"09-4129632","numberOfSeats":50,"testerEmailAddress":"cvs.dev1@dvsagov.onmicrosoft.com","euVehicleCategory":"m1","order":{"current":2,"total":2}}',
            messageAttributes: {},
            md5OfBody: '9586727cbc9f3312542387099b60982c',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:eu-west-2:006106226016:cert-gen-q',
            awsRegion: 'eu-west-2',
          },
        ],
      };

      it('should invoke certificate generate and upload services', () => {
        // Stub CertificateGenerationService generateCertificate method
        const certGenServiceStub = sandbox
          .stub(CertificateGenerationService.prototype, 'generateCertificate')
          .resolvesThis();
        // Stub CertificateUploadService uploadCertificate method
        const certUploadServiceStub = sandbox
          .stub(CertificateUploadService.prototype, 'uploadCertificate')
          .resolvesThis();

        return lambda.event(payload).expectResolve((response: any) => {
          sinon.assert.callCount(certGenServiceStub, 1);
          sinon.assert.callCount(certUploadServiceStub, 1);
          certGenServiceStub.restore();
          certUploadServiceStub.restore();
        });
      });
    },
  );

  context(
    'when the certGen function is invoked with invalid testResultId for certificate generation.',
    () => {
      const lambda = lambdaTester(certGen);
      const payload: any = {
        Records: [
          {
            messageId: 'h48c54a0-7027-4e37-b7e8-c8d231511c89',
            receiptHandle:
              'AQEBJcBvTRZ1W2LSaUJ0g0ELXlqA8WCL4zJxO63wu0YOVhx44xxxPhsnc+/Q9+1vOPYO+3HupEjXzGRSvfPY5rEEJkgCJe4/RQ+q2kU5LsmJEr1qE/CTdIYe5X/75XeMQ523KKpdNsD9tRhyvEpPpSu50byGbz7J0JyR6lu1E6Q4YuB4QNm+ev1obPMLdEt8RhgvIi/NfEfQf0L1r3TPi3wLho1R61PllPm27He8/1CjCnMyWBzgX+DCjJ7vyRXObMZ/MbhMBKbYpeTcejsKpYX//PPr1yvldp1YPC0wPKp+iqmWxoDDeHXbo8xYRFXDA8rnY5RfkwxxffH7o534vYn8FCZEtqybQuo7pumu6Ah9PsC05tP38syU71ltasljGIA35BgCdSO+9r5rTaBnbO9++Q==',
            body: '{"testerStaffId":"1","testStartTimestamp":"2019-02-26T14:50:44.279Z","odometerReadingUnits":"kilometres","testEndTimestamp":"2019-02-26T15:02:10.761Z","testStatus":"submitted","testTypes":{"testNumber":"W01A00310","prohibitionIssued":false,"cvsTestUpdated":false,"testCode":"aas","lastUpdatedAt":"2019-02-26T15:29:39.537Z","numberOfSeatbeltsFitted":2,"testTypeEndTimestamp":"2019-02-26T15:02:37.392Z","lastSeatbeltInstallationCheckDate":"2019-02-26","createdAt":"2019-02-26T15:29:39.537Z","testTypeId":"1","testTypeStartTimestamp":"2019-02-26T14:51:54.180Z","certificateNumber":"321","seatbeltInstallationCheckDate":true,"testTypeName":"Annual test","defects":[{"deficiencyCategory":"dangerous","deficiencyText":"not working correctly and obviously affects steering control.","prs":false,"additionalInformation":{"notes":"Asdasd","location":{"axleNumber":7,"horizontal":"inner","lateral":"offside"}},"deficiencyRef":"54.1.a.ii","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"ii","deficiencyId":"a","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"minor","deficiencyText":"reservoir is below minimum level.","prs":false,"additionalInformation":{"location":{"axleNumber":7,"horizontal":"outer","lateral":"nearside"}},"deficiencyRef":"54.1.d.i","itemNumber":1,"stdForProhibition":false,"deficiencySubId":"i","deficiencyId":"d","imDescription":"Steering","itemDescription":"Power steering:","imNumber":54},{"deficiencyCategory":"advisory","deficiencyText":"null","prs":false,"additionalInformation":{"notes":"Dasdasdccc","location":{}},"deficiencyRef":"5.1","itemNumber":1,"stdForProhibition":false,"deficiencySubId":null,"deficiencyId":null,"imDescription":"Exhaust Emissions","itemDescription":"Compression Ignition Engines Statutory Smoke Meter Test:","imNumber":5}],"name":"Annual test","testResult":"fail"},"vehicleClass":{"code":"s","description":"small psv (ie: less than or equal to 22 seats)"},"testResultId":"2bed0f4f-5ab2-499b-98ce","vehicleSize":"small","vin":"XMGDE02FS0H012345","testStationName":"Abshire-Kub","vehicleId":"BQ91YHQ","countryOfRegistration":"gb","vehicleType":"psv","preparerId":"AK4434","preparerName":"Durrell Vehicles Limited","odometerReading":12312,"vehicleConfiguration":"rigid","testStationType":"gvts","testerName":"CVS Dev1","vrm":"BQ91YHQ","testStationPNumber":"09-4129632","numberOfSeats":50,"testerEmailAddress":"cvs.dev1@dvsagov.onmicrosoft.com","euVehicleCategory":"m1","order":{"current":2,"total":2}}',
            messageAttributes: {},
            md5OfBody: '9586727cbc9f3312542387099b60982c',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:eu-west-2:006106226016:cert-gen-q',
            awsRegion: 'eu-west-2',
          },
        ],
      };

      it('should not invoke certificate generate and upload services', () => {
        // Stub CertificateGenerationService generateCertificate method
        const certGenServiceStub = sandbox.stub(
          CertificateGenerationService.prototype,
          'generateCertificate',
        );
        // Stub CertificateUploadService uploadCertificate method
        const certUploadServiceStub = sandbox.stub(
          CertificateUploadService.prototype,
          'uploadCertificate',
        );

        return lambda.event(payload).expectReject((response: any) => {
          sinon.assert.callCount(certGenServiceStub, 0);
          sinon.assert.callCount(certUploadServiceStub, 0);
          certGenServiceStub.restore();
          certUploadServiceStub.restore();
        });
      });
    },
  );
});
