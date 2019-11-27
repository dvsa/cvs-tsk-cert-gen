import {CertificateGenerationService} from "../../src/services/CertificateGenerationService";
import sinon from "sinon";
import techRecordResp from "../resources/tech-records-response.json";
import {AWSError, Lambda, Response} from "aws-sdk";
import {LambdaService} from "../../src/services/LambdaService";

describe("Certificate Generation Service", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
  });

  describe("getVehicleMakeAndModel function", () => {
    context("when given a vin with matching record", () => {
      it("should return the record & only invoke the LambdaService once", async () => {
        const LambdaStub = sandbox.stub(LambdaService.prototype, "invoke").resolves(AWSResolve(JSON.stringify(techRecordResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, new LambdaService(new Lambda()));
        const testResultMock = {
          vin: "abc123"
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(testResultMock);
        expect(LambdaStub.calledOnce).toBeTruthy();
        expect(makeAndModel).toEqual({Make: "Mercedes", Model: "632,01"});
      });
    });

    context("when given a vin with no matching record but a matching partialVin", () => {
      it("should return the record & invoke the LambdaService twice", async () => {
        const LambdaStub = sandbox.stub(LambdaService.prototype, "invoke")
          .onFirstCall().resolves(AWSReject("no"))
          .onSecondCall().resolves(AWSResolve(JSON.stringify(techRecordResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, new LambdaService(new Lambda()));
        const testResultMock = {
          vin: "abc123",
          partialVin: "abc123"
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(testResultMock);
        expect(LambdaStub.calledOnce).toBeFalsy();
        expect(LambdaStub.calledTwice).toBeTruthy();
        expect(makeAndModel).toEqual({Make: "Mercedes", Model: "632,01"});
      });
    });

    context("when given a vin and partialVin with no matching record but a matching VRM", () => {
      it("should return the record & invoke the LambdaService three times", async () => {
        const LambdaStub = sandbox.stub(LambdaService.prototype, "invoke")
          .onFirstCall().resolves(AWSReject("no"))
          .onSecondCall().resolves(AWSReject("no"))
          .onThirdCall().resolves(AWSResolve(JSON.stringify(techRecordResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, new LambdaService(new Lambda()));
        const testResultMock = {
          vin: "abc123",
          partialVin: "abc123",
          vrm: "testvrm"
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(testResultMock);
        expect(LambdaStub.calledOnce).toBeFalsy();
        expect(LambdaStub.calledTwice).toBeFalsy();
        expect(LambdaStub.calledThrice).toBeTruthy();
        expect(makeAndModel).toEqual({Make: "Mercedes", Model: "632,01"});
      });
    });

    context("when given a vin, partialVin and VRM with no matching record but a matching TrailerID", () => {
      it("should return the record & invoke the LambdaService four times", async () => {
        const LambdaStub = sandbox.stub(LambdaService.prototype, "invoke")
          .onFirstCall().resolves(AWSReject("no"))
          .onSecondCall().resolves(AWSReject("no"))
          .onThirdCall().resolves(AWSReject("no"))
          .onCall(3).resolves(AWSResolve(JSON.stringify(techRecordResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, new LambdaService(new Lambda()));
        const testResultMock = {
          vin: "abc123",
          partialVin: "abc123",
          vrm: "testvrm",
          trailerId: "testTrailerId"
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(testResultMock);
        expect(LambdaStub.callCount).toEqual(4);
        expect(makeAndModel).toEqual({Make: "Mercedes", Model: "632,01"});
      });
    });

    context("when given a vehicle details with no matching records", () => {
      it("should call Tech Records Lambda 4 times and then throw an error", async () => {
        const LambdaStub = sandbox.stub(LambdaService.prototype, "invoke").resolves(AWSReject("no"));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, new LambdaService(new Lambda()));
        const testResultMock = {
          vin: "abc123",
          partialVin: "abc123",
          vrm: "testvrm",
          trailerId: "testTrailerId"
        };
        try {
          await certGenSvc.getVehicleMakeAndModel(testResultMock);
        } catch (e) {
          expect(LambdaStub.callCount).toEqual(4);
          expect(e).toBeInstanceOf(Error);
          expect(e.message).toEqual("Unable to retrieve Tech Record for Test Result");
        }
      });
    });

    context("when given a vehicle details with missing vehicle detail fields and no match", () => {
      it("should call Tech Records Lambda matching number (2) times and then throw an error", async () => {
        const LambdaStub = sandbox.stub(LambdaService.prototype, "invoke").resolves(AWSReject("no"));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, new LambdaService(new Lambda()));
        const testResultMock = {
          vin: "abc123",
          trailerId: "testTrailerId"
        };
        try {
          await certGenSvc.getVehicleMakeAndModel(testResultMock);
        } catch (e) {
          expect(LambdaStub.callCount).toEqual(2);
          expect(e).toBeInstanceOf(Error);
          expect(e.message).toEqual("Unable to retrieve Tech Record for Test Result");
        }
      });
    });
  });

  describe("generateCertificateData function", () => {
    describe("when passed a LEC type and record", () => {
      it("returns an LEC style object with correct mappings", async () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(null, null);
        const input: any = {
          testStationName: "testStation",
          testStationPNumber: "P123456",
          testTypes: {
            certificateNumber:  "A654321",
            createdAt: "2019-02-26T15:29:39.537Z",
            testExpiryDate: "2020-02-26T15:29:39.537Z",
            emissionStandard: "Low",
            particulateTrapFitted: "vGood",
            particulateTrapSerialNumber: "abc123",
            modType: {
              code: "p",
              description: "Particulate trap"
            },
            smokeTestKLimitApplied: 5
          },
          vin: "12345678",
          vrm: "AA00AAA"
        };
        expect.assertions(6);
        let output = await certGenSvc.generateCertificateData(input, "LEC_DATA");
        expect(output.PrescribedEmissionStandard).toEqual(input.testTypes.emissionStandard);
        expect(output.TestStationName).toEqual(input.testStationName);
        expect(output.ExpiryDate).toEqual("26.02.2020");
        expect(output.DateOfTheTest).toEqual("26.02.2019");
        expect(output.ModificationTypeUsed).toEqual(undefined);

        input.testTypes.testExpiryDate = null;
        output = await certGenSvc.generateCertificateData(input, "LEC_DATA");
        expect(output.ExpiryDate).toEqual(undefined);
      });
    });
  });

  describe("generatePayload function", () => {
    describe("LEC Test type", () => {
      it("returns an LEC_DATA payload", async () => {
        const input: any = {
          testStationName: "testStation",
          testStationPNumber: "P123456",
          vehicleType: "PSV",
          testTypes: {
            certificateNumber:  "A654321",
            createdAt: "2019-02-26T15:29:39.537Z",
            testExpiryDate: "2020-02-26T15:29:39.537Z",
            emissionStandard: "Low",
            particulateTrapFitted: "vGood",
            particulateTrapSerialNumber: "abc123",
            modType: {
              code: "p",
              description: "Particulate trap"
            },
            smokeTestKLimitApplied: 5,
            testTypeId: "39"
          },
          vin: "12345678",
          vrm: "AA00AAA"
        };

        CertificateGenerationService.prototype.getSignature = jest.fn().mockResolvedValue("signatureString");
        CertificateGenerationService.prototype.getVehicleMakeAndModel = jest.fn().mockResolvedValue({Make: "make", Model: "model"});
        CertificateGenerationService.prototype.getOdometerHistory = jest.fn().mockResolvedValue({value: 1234});

        expect.assertions(3);
        // @ts-ignore
        const svc = new CertificateGenerationService(null, null);
        const output = await svc.generatePayload(input);
        expect(output.LEC_DATA).toBeTruthy(); // Don't care about details - test that elsewhere.
        expect(output.ADR_DATA).toBeFalsy();
        expect(output.DATA).toBeFalsy();
      });
    });
  });
});

const AWSResolve = (payload: any) => {
  const response = new Response<Lambda.Types.InvocationResponse, AWSError>();
  Object.assign(response, {
    data: {
      StatusCode: 200,
      Payload: payload
    }
  });

  return {
    $response: response,
    StatusCode: 200,
    Payload: payload
  };
};

const AWSReject = (payload: any) => {
  const response = new Response<Lambda.Types.InvocationResponse, AWSError>();
  Object.assign(response, {
    data: {
      StatusCode: 400,
      Payload: payload
    }
  });

  return {
    $response: response,
    StatusCode: 400,
    Payload: payload
  };
};
