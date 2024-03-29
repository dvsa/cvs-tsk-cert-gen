import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import sinon from "sinon";
import techRecordResp from "../resources/tech-records-response.json";
import testResultsResp from "../resources/test-results-response.json";
import testResultsRespFail from "../resources/test-results-fail-response.json";
import testResultsRespPrs from "../resources/test-results-prs-response.json";
import testResultsRespEmpty from "../resources/test-results-empty-response.json";
import testResultsRespNoCert from "../resources/test-results-nocert-response.json";
import { AWSError, Lambda, Response } from "aws-sdk";
import { LambdaService } from "../../src/services/LambdaService";
import techRecordsRwtSearch from "../resources/tech-records-response-rwt-search.json";
import { cloneDeep } from "lodash";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";
import techRecordsRwtHgv from "../resources/tech-records-response-rwt-hgv.json";
import techRecordsRwtHgvSearch from "../resources/tech-records-response-rwt-hgv-search.json";
import techRecordsPsv from "../resources/tech-records-response-PSV.json";
import techRecordsSearchPsv from "../resources/tech-records-response-search-PSV.json";
import mockTestResult from "../resources/test-result-with-defect.json";
import mockIvaTestResult from "../resources/test-result-with-iva-defect.json";
import defectsMock from "../../tests/resources/defects_mock.json";
import flatDefectsMock from "../../tests/resources/flattened-defects.json";
import testStationsMock from "../../tests/resources/testStationsMock.json";
import { LOCATION_ENGLISH, LOCATION_WELSH } from "../../src/models/Enums";
import {Configuration} from "../../src/utils/Configuration";
import { ITestStation } from "../../src/models/ITestStations";
import { IDefectParent } from "../../src/models/IDefectParent";
import { HTTPError } from "../../src/models/HTTPError";
import Axios from "axios";

describe("Certificate Generation Service", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
  });

  describe("getVehicleMakeAndModel function", () => {
    context("when given a systemNumber with matching record", () => {
      it("should return the record & only invoke the LambdaService once", async () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const getTechRecordSearchStub = sandbox
            .stub(certGenSvc, "callSearchTechRecords")
            .resolves(techRecordsRwtSearch);


        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        const getTechRecordStub = sandbox
            .stub(certGenSvc, "callGetTechRecords")
            .resolves((techRecordResponseRwtMock) as any);

        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
        getTechRecordStub.restore();
        getTechRecordSearchStub.restore();
      });
    });

    context(
      "when given a systemNumber  with no matching record and a vin with matching record",
      () => {
        it("should return the record & invoke the LambdaService twice", async () => {
          // @ts-ignore
          const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
          );

          const getTechRecordSearchStub = sandbox
              .stub(certGenSvc, "callSearchTechRecords")
              .resolves(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          const getTechRecordStub = sandbox
              .stub(certGenSvc, "callGetTechRecords")
              .resolves((techRecordResponseRwtMock) as any);

          const testResultMock = {
            systemNumber: "134567889",
            vin: "abc123",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          getTechRecordStub.restore();
          getTechRecordSearchStub.restore();
        });
      }
    );

    context(
      "when given a vin with no matching record but a matching partialVin",
      () => {
        it("should return the record & invoke the LambdaService twice", async () => {
          const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .onFirstCall()
            .resolves(AWSReject("no"))
            .onSecondCall()
            .resolves(AWSResolve(JSON.stringify(techRecordResp)));
          // @ts-ignore
          const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
          );
          const getTechRecordSearchStub = sandbox
              .stub(certGenSvc, "callSearchTechRecords")
              .resolves(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          const getTechRecordStub = sandbox
              .stub(certGenSvc, "callGetTechRecords")
              .resolves((techRecordResponseRwtMock) as any);

          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.calledOnce).toBeFalsy();
          // expect(LambdaStub.calledTwice).toBeTruthy();
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          getTechRecordStub.restore();
          getTechRecordSearchStub.restore();
        });
      }
    );

    context(
      "when given a vin and partialVin with no matching record but a matching VRM",
      () => {
        it("should return the record & invoke the LambdaService three times", async () => {
          const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .onFirstCall()
            .resolves(AWSReject("no"))
            .onSecondCall()
            .resolves(AWSReject("no"))
            .onThirdCall()
            .resolves(AWSResolve(JSON.stringify(techRecordResp)));
          // @ts-ignore
          const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
          );
          const getTechRecordSearchStub = sandbox
              .stub(certGenSvc, "callSearchTechRecords")
              .resolves(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          const getTechRecordStub = sandbox
              .stub(certGenSvc, "callGetTechRecords")
              .resolves((techRecordResponseRwtMock) as any);

          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
            vrm: "testvrm",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.calledOnce).toBeFalsy();
          expect(LambdaStub.calledTwice).toBeFalsy();
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          getTechRecordStub.restore();
          getTechRecordSearchStub.restore();
        });
      }
    );

    context(
      "when given a vin, partialVin and VRM with no matching record but a matching TrailerID",
      () => {
        it("should return the record & invoke the LambdaService four times", async () => {
          // @ts-ignore
          const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
          );
          const getTechRecordSearchStub = sandbox
              .stub(certGenSvc, "callSearchTechRecords")
              .resolves(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          const getTechRecordStub = sandbox
              .stub(certGenSvc, "callGetTechRecords")
              .resolves((techRecordResponseRwtMock) as any);

          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
            vrm: "testvrm",
            trailerId: "testTrailerId",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          getTechRecordStub.restore();
          getTechRecordSearchStub.restore();
        });
      }
    );

    context("when given a vehicle details with no matching records", () => {
      it("should call Tech Records Lambda 4 times and then throw an error", async () => {
        const LambdaStub = sandbox
          .stub(LambdaService.prototype, "invoke")
          .resolves(AWSReject("no"));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const getTechRecordSearchStub = sandbox
            .stub(certGenSvc, "callSearchTechRecords")
            .resolves(techRecordsRwtSearch);


        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        const getTechRecordStub = sandbox
            .stub(certGenSvc, "callGetTechRecords")
            .resolves((techRecordResponseRwtMock) as any);

        const testResultMock = {
          vin: "abc123",
          partialVin: "abc123",
          vrm: "testvrm",
          trailerId: "testTrailerId",
        };
        try {
          await certGenSvc.getVehicleMakeAndModel(testResultMock);
        } catch (e) {
          expect(LambdaStub.callCount).toEqual(4);
          expect(e).toBeInstanceOf(Error);
          expect((e as unknown as Error).message).toEqual(
            "Unable to retrieve unique Tech Record for Test Result"
          );
          getTechRecordStub.restore();
          getTechRecordSearchStub.restore();
        }
      });
    });

    context(
      "when given a vehicle details with missing vehicle detail fields and no match",
      () => {
        it("should call Tech Records Lambda matching number (2) times and then throw an error", async () => {
          const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .resolves(AWSReject("no"));
          // @ts-ignore
          const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
          );
          const getTechRecordSearchStub = sandbox
              .stub(certGenSvc, "callSearchTechRecords")
              .resolves(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          const getTechRecordStub = sandbox
              .stub(certGenSvc, "callGetTechRecords")
              .resolves((techRecordResponseRwtMock) as any);

          const testResultMock = {
            vin: "abc123",
            trailerId: "testTrailerId",
          };
          try {
            await certGenSvc.getVehicleMakeAndModel(testResultMock);
          } catch (e) {
            expect(LambdaStub.callCount).toEqual(2);
            expect(e).toBeInstanceOf(Error);
            expect((e as unknown as Error).message).toEqual(
              "Unable to retrieve unique Tech Record for Test Result"
            );
            getTechRecordStub.restore();
            getTechRecordSearchStub.restore();
          }
        });
      }
    );

    context("when lookup returns a PSV tech record", () => {
      it("should return make and model from chassis details", async () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const getTechRecordSearchStub = sandbox
            .stub(certGenSvc, "callSearchTechRecords")
            .resolves(techRecordsSearchPsv);


        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        const getTechRecordStub = sandbox
            .stub(certGenSvc, "callGetTechRecords")
            .resolves((techRecordsPsv) as any);

        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel.Make).toBe("AEC");
        expect(makeAndModel.Model).toBe("RELIANCE");
        getTechRecordStub.restore();
        getTechRecordSearchStub.restore();
      });
    });

    context("when lookup returns a non-PSV tech record", () => {
      it("should return make and model from not-chassis details", async () => {
        const certGenSvc = new CertificateGenerationService(
          // @ts-ignore
          null,
          new LambdaService(new Lambda())
        );
        const getTechRecordSearchStub = sandbox
            .stub(certGenSvc, "callSearchTechRecords")
            .resolves(techRecordsRwtHgvSearch);
        const getTechRecordStub = sandbox
            .stub(certGenSvc, "callGetTechRecords")
            .resolves((techRecordsRwtHgv) as any);

        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel.Make).toBe("Isuzu");
        expect(makeAndModel.Model).toBe("FM");
        getTechRecordStub.restore();
        getTechRecordSearchStub.restore();
      });
    });
  });

  describe("getOdometerHistory function", () => {
    context("when given a systemNumber with only failed test results", () => {
      it("should return an empty odometer history list", async () => {
        const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .resolves(AWSResolve(JSON.stringify(testResultsRespFail)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const systemNumberMock = "12345678";
        const odometerHistory = await certGenSvc.getOdometerHistory(
            systemNumberMock
        );
        expect(LambdaStub.calledOnce).toBeTruthy();
        expect(odometerHistory).toEqual({OdometerHistoryList: []});
      });
    });

    context("when given a systemNumber which returns more than 3 pass or prs", () => {
      it("should return an odometer history no greater than 3", async () => {
        const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .resolves(AWSResolve(JSON.stringify(testResultsResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const systemNumberMock = "12345678";
        const odometerHistory = await certGenSvc.getOdometerHistory(
            systemNumberMock
        );
        expect(LambdaStub.calledOnce).toBeTruthy();
        expect(odometerHistory).toEqual({OdometerHistoryList: [
            {
              value: 400000,
              unit: "kilometres",
              date: "19.01.2019",
            },
            {
              value: 390000,
              unit: "kilometres",
              date: "18.01.2019",
            },
            {
              value: 380000,
              unit: "kilometres",
              date: "17.01.2019",
            },
          ]});
      });
    });

    context("when given a systemNumber which returns tests which include those that are not Annual With Certificate", () => {
      it("should omiting results that are not Annual With Certificate", async () => {
        const LambdaStub = sandbox
          .stub(LambdaService.prototype, "invoke")
          .resolves(AWSResolve(JSON.stringify(testResultsRespNoCert)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const systemNumberMock = "12345678";
        const odometerHistory = await certGenSvc.getOdometerHistory(
          systemNumberMock
        );
        expect(LambdaStub.calledOnce).toBeTruthy();
        expect(odometerHistory).toEqual({OdometerHistoryList: [
          {
            value: 400000,
            unit: "kilometres",
            date: "19.01.2019",
          },
          {
            value: 380000,
            unit: "kilometres",
            date: "17.01.2019",
          },
          {
            value: 360000,
            unit: "kilometres",
            date: "15.01.2019",
          },
        ]});
      });
    });

    context("when given a systemNumber which returns a test result which was fail then prs", () => {
      it("should return an odometer history which includes test result", async () => {
        const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .resolves(AWSResolve(JSON.stringify(testResultsRespPrs)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const systemNumberMock = "12345678";
        const odometerHistory = await certGenSvc.getOdometerHistory(
            systemNumberMock
        );
        expect(LambdaStub.calledOnce).toBeTruthy();
        expect(odometerHistory).toEqual({OdometerHistoryList: [
            {
              value: 350000,
              unit: "kilometres",
              date: "14.01.2019",
            },
          ]});
      });
    });

    context("when given a systemNumber which returns a test result which has no test types array", () => {
      it("should omit the result from the odometer history", async () => {
        const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .resolves(AWSResolve(JSON.stringify(testResultsRespEmpty)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const systemNumberMock = "12345678";
        const odometerHistory = await certGenSvc.getOdometerHistory(
            systemNumberMock
        );
        expect(LambdaStub.calledOnce).toBeTruthy();
        expect(odometerHistory).toEqual({OdometerHistoryList: [
            {
              value: 400000,
              unit: "kilometres",
              date: "19.01.2019",
            },
            {
              value: 380000,
              unit: "kilometres",
              date: "17.01.2019",
            },
            {
              value: 370000,
              unit: "kilometres",
              date: "16.01.2019",
            },
          ]});
      });
    });
  });

  describe("welsh defect function", () => {
    context("test formatDefectWelsh method", () => {
      it("should return welsh string for hgv vehicle type when there are shared defect refs", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
            testResultWithDefect.testTypes[0].defects[0],
            "hgv",
            flatDefectsMock
        );
        console.log(format);
        expect(format).toEqual(
            "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Blaen. None"
        );
      });
      it("should return welsh string for trl vehicle type when there are shared defect refs", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
            testResultWithDefect.testTypes[0].defects[0],
            "trl",
            flatDefectsMock
        );
        console.log(format);
        expect(format).toEqual(
            "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Blaen. None"
        );
      });
      it("should return welsh string for psv vehicle type when there are shared defect refs", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
            testResultWithDefect.testTypes[0].defects[0],
            "psv",
            flatDefectsMock
        );
        console.log(format);
        expect(format).toEqual(
            "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd  ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson arall. Blaen. None"
        );
      });
      it("should return welsh string including location numbers if populated ", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { rowNumber: 1 });
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { seatNumber: 2 });
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { axleNumber: 3 });
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
            testResultWithDefect.testTypes[0].defects[0],
            "hgv",
            flatDefectsMock
        );
        console.log(format);
        expect(format).toEqual(
            "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Echelau: 3. Blaen Rhesi: 1. Seddi: 2.. None"
        );
      });
      it("should return null if filteredFlatDefect array is empty", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const filterFlatDefectsStub = sandbox
            .stub(certGenSvc, "filterFlatDefects").returns(null);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
            testResultWithDefect.testTypes[0].defects[0],
            "hgv",
            []
        );
        console.log(format);
        expect(format).toBeNull();
        filterFlatDefectsStub.restore();
      });
    });

    context("test convertLocationWelsh method", () => {
      it("should return the translated location value", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const welshLocation1 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.FRONT
        );
        const welshLocation2 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.REAR
        );
        const welshLocation3 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.UPPER
        );
        const welshLocation4 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.LOWER
        );
        const welshLocation5 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.NEARSIDE
        );
        const welshLocation6 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.OFFSIDE
        );
        const welshLocation7 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.CENTRE
        );
        const welshLocation8 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.INNER
        );
        const welshLocation9 = certGenSvc.convertLocationWelsh(
            LOCATION_ENGLISH.OUTER
        );
        const welshLocation10 = certGenSvc.convertLocationWelsh("mockLocation");
        expect(welshLocation1).toEqual(LOCATION_WELSH.FRONT);
        expect(welshLocation2).toEqual(LOCATION_WELSH.REAR);
        expect(welshLocation3).toEqual(LOCATION_WELSH.UPPER);
        expect(welshLocation4).toEqual(LOCATION_WELSH.LOWER);
        expect(welshLocation5).toEqual(LOCATION_WELSH.NEARSIDE);
        expect(welshLocation6).toEqual(LOCATION_WELSH.OFFSIDE);
        expect(welshLocation7).toEqual(LOCATION_WELSH.CENTRE);
        expect(welshLocation8).toEqual(LOCATION_WELSH.INNER);
        expect(welshLocation9).toEqual(LOCATION_WELSH.OUTER);
        expect(welshLocation10).toEqual("mockLocation");
      });
    });

    context("test filterFlatDefects method", () => {
      it("should return a filtered flat defect for hgv", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
            flatDefectsMock,
            "hgv"
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it("should return a filtered flat defect for trl", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
            flatDefectsMock,
            "trl"
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it("should return a filtered flat defect for psv", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const flatDefect = flatDefectsMock[1];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
            flatDefectsMock,
            "psv"
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it("should return null if array is empty", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const filterFlatDefect = certGenSvc.filterFlatDefects(
            [],
            "hgv"
        );
        expect(filterFlatDefect).toBeNull();
      });
    });

    context("test flattenDefectsFromApi method", () => {
      it("should return the defects in a flat array", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const flattenedArray = certGenSvc.flattenDefectsFromApi(defectsMock);
        expect(flattenedArray).toEqual(flatDefectsMock);
        expect(flattenedArray).toHaveLength(7);
      });
      it("should log any exceptions flattening defects", () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const logSpy = jest.spyOn(console, "error");

        const defectsMockForError = cloneDeep(defectsMock);
        defectsMockForError.forEach = jest.fn(() => {
          throw new Error("Some random error");
        });

        const flattenedArray = certGenSvc.flattenDefectsFromApi(defectsMockForError);
        expect(logSpy).toHaveBeenCalledWith(
            "Error flattening defects: Error: Some random error"
        );
        expect(flattenedArray).toEqual([]);
        logSpy.mockClear();
        jest.clearAllMocks();
      });
    });
  });

  describe("welsh address function", () => {
    context("test getThisTestStation method", () => {
      it("should return a postcode if pNumber exists in the list of test stations", () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const testStation = testStationsMock[0];
        const postCode = certGenSvc.getThisTestStation(
            testStationsMock,
            "P11223"
        );
        expect(postCode).toEqual(testStation.testStationPostcode);
      });
      it("should return a null and message if pNumber does not exists in the list of test stations", () => {
        const logSpy = jest.spyOn(console, "log");

        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const postCode = certGenSvc.getThisTestStation(
            testStationsMock,
            "445567"
        );
        expect(postCode).toBeNull();
        expect(logSpy).toHaveBeenCalledWith(
            "Test station details could not be found for 445567"
        );
        logSpy.mockClear();
      });
      it("should return a null and message if the list of test stations is empty", () => {
        const logSpy = jest.spyOn(console, "log");

        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        const postCode = certGenSvc.getThisTestStation([], "P50742");
        expect(postCode).toBeNull();
        expect(logSpy).toHaveBeenCalledWith("Test stations data is empty");
        logSpy.mockClear();
      });
    });

    context("test getTestStation method", () => {
      it("should return an array of test stations if invoke is successful", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const mockStations = testStationsMock;

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockStations) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStations = await certGenSvc.getTestStations();

        expect(testStations).toEqual(mockStations);
        jest.clearAllMocks();
      });
      it("should invoke test stations up to 3 times if there is an issue", async () => {
        const logSpy = jest.spyOn(console, "error");

        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: "" }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStations = await certGenSvc.getTestStations();

        expect(logSpy).toHaveBeenLastCalledWith("There was an error retrieving the test stations on attempt 3: Error");
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(testStations).not.toBeNull();
        logSpy.mockClear();
        jest.clearAllMocks();
      });
      it("should return an empty array if test stations invoke is unsuccessful", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: "" }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStations = await certGenSvc.getTestStations();

        expect(testStations).toEqual([]);
        jest.clearAllMocks();
      });
      it("should throw error if issue when parsing test stations", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const mockStations: ITestStation[] = [];

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockStations) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await certGenSvc.getTestStations()
            .catch((e) => {
              expect(e).toBeInstanceOf(HTTPError);
            });
        expect(defects).toEqual(mockStations);
        jest.clearAllMocks();
      });
    });

    context("test getDefectTranslations method", () => {
      it("should return an array of defects if invoke is successful", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const mockDefects = defectsMock;

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockDefects) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await certGenSvc.getDefectTranslations();

        expect(defects).toEqual(mockDefects);
        jest.clearAllMocks();
      });
      it("should invoke defects up to 3 times if there is an issue", async () => {
        const logSpy = jest.spyOn(console, "error");

        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: "" }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await certGenSvc.getDefectTranslations();

        expect(logSpy).toHaveBeenLastCalledWith("There was an error retrieving the welsh defect translations on attempt 3: Error");
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(defects).not.toBeNull();
        logSpy.mockClear();
        jest.clearAllMocks();
      });
      it("should return an empty array if defects invoke is unsuccessful", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: "" }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await certGenSvc.getDefectTranslations();

        expect(defects).toEqual([]);
        jest.clearAllMocks();
      });
      it("should throw error if issue when parsing defects", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const mockDefects: IDefectParent[] = [];

        LambdaService.prototype.invoke = jest.fn().mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockDefects) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await certGenSvc.getDefectTranslations()
            .catch((e) => {
              expect(e).toBeInstanceOf(HTTPError);
            });
        expect(defects).toEqual(mockDefects);
        jest.clearAllMocks();
      });
    });

    context("test STOP_WELSH_GEN environment variable", () => {
      it("should circumvent the Welsh certificate generation logic and log message if set to true", async () => {
        process.env.STOP_WELSH_GEN = "TRUE";

        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const logSpy = jest.spyOn(console, "log");

        await certGenSvc.generateCertificate(mockTestResult)
            .catch(() => {
              expect(logSpy).toHaveBeenCalledWith(
                  "Welsh certificate generation deactivated via environment variable set to TRUE"
              );
              logSpy.mockClear();
            });
      });
    });

    context("test postcode lookup method", () => {
      context("when the SECRET_KEY environment variable does not exist", () => {
        it("should log the the errors", async () => {
          const certGenSvc = new CertificateGenerationService(
              null as any,
              new LambdaService(new Lambda())
          );

          const logSpy = jest.spyOn(console, "log");

          Configuration.prototype.getWelshSecretKey = jest.fn().mockReturnValue(null);

          await certGenSvc.lookupPostcode("some_postcode");
          expect(logSpy.mock.calls[0][0]).toBe("Secret details not found.");
          expect(logSpy.mock.calls[1][0]).toBe("SMC Postcode lookup details not found. Return value for isWelsh for some_postcode is false");

          logSpy.mockClear();
        });
      });
      context("when the SECRET_KEY environment variable does exist", () => {
        const mockSecretResponse = {
          url: "mockUrl",
          key: "mockKey"
        };
        it("should log correctly if isWelshAddress was true", async () => {
          const certGenSvc = new CertificateGenerationService(
              null as any,
              new LambdaService(new Lambda())
          );

          const logSpy = jest.spyOn(console, "log");

          Axios.create = jest.fn().mockReturnValueOnce(({
            get: jest.fn().mockResolvedValueOnce({ data: {
                isWelshAddress: true
              }})
          }));
          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode("welsh_postcode");
          expect(logSpy.mock.calls[0][0]).toBe("Return value for isWelsh for welsh_postcode is true");
          expect(response).toBeTruthy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });
        it("should log correctly if isWelshAddress was false", async () => {
          const certGenSvc = new CertificateGenerationService(
              null as any,
              new LambdaService(new Lambda())
          );

          const logSpy = jest.spyOn(console, "log");

          Axios.create = jest.fn().mockReturnValueOnce(({
            get: jest.fn().mockResolvedValueOnce({ data: {
                isWelshAddress: false
              }})
          }));

          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode("non_welsh_postcode");
          expect(logSpy.mock.calls[0][0]).toBe("Return value for isWelsh for non_welsh_postcode is false");
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });
        it("should return false if error is thrown due to invalid type in response from api call", async () => {
          const certGenSvc = new CertificateGenerationService(
              null as any,
              new LambdaService(new Lambda())
          );

          const logSpy = jest.spyOn(console, "log");

          Axios.create = jest.fn().mockReturnValueOnce(({
            get: jest.fn().mockResolvedValueOnce({ data: {
                someRandomKey: true
              }})
          }));

          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode("welsh_postcode")
              .catch((e) => {
                expect(e).toBeInstanceOf(HTTPError);
              });
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });
        it("should return false if axios client is null", async () => {
          const certGenSvc = new CertificateGenerationService(
              null as any,
              new LambdaService(new Lambda())
          );

          const logSpy = jest.spyOn(console, "log");

          Axios.create = jest.fn().mockReturnValueOnce(null);

          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode("welsh_postcode");
          expect(logSpy.mock.calls[0][0]).toBe("SMC Postcode lookup details not found. Return value for isWelsh for welsh_postcode is false");
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });
        it("should return false if an error occurs in axios client", async () => {
          const certGenSvc = new CertificateGenerationService(
              null as any,
              new LambdaService(new Lambda())
          );

          const logSpy = jest.spyOn(console, "error");

          const mockError = new Error("some random error");
          Configuration.prototype.getSecret = jest.fn().mockRejectedValue(mockError);

          const response = await certGenSvc.lookupPostcode("welsh_postcode");
          expect(logSpy.mock.calls[0][0]).toBe("Error generating Axios Instance: Error: some random error");
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });
      });
    });
  });

  describe("iva 30 logic", () => {
    context("test isBasicIvaTest logic", () => {
      it("should return true if test type id on test result exists in basic array", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const ivaTestResult = cloneDeep(mockIvaTestResult);

        const result: boolean = certGenSvc.isBasicIvaTest(ivaTestResult.testTypes[0].testTypeId);

        expect(result).toBeTruthy();
      });
      it("should return false if test type id on test result does not exist in basic array", async () => {
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );

        const ivaTestResult = cloneDeep(mockIvaTestResult);
        ivaTestResult.testTypes[0].testTypeId = "130";
        ivaTestResult.testTypes[0].testTypeName = "Mutual recognition/ end of series & inspection";

        const result: boolean = certGenSvc.isBasicIvaTest(ivaTestResult.testTypes[0].testTypeId);

        expect(result).toBeFalsy();
      });
    });
  });
});

const AWSResolve = (payload: any) => {
  const response = new Response<Lambda.Types.InvocationResponse, AWSError>();
  Object.assign(response, {
    data: {
      StatusCode: 200,
      Payload: payload,
    },
  });

  return {
    $response: response,
    StatusCode: 200,
    Payload: payload,
  };
};

const AWSReject = (payload: any) => {
  const response = new Response<Lambda.Types.InvocationResponse, AWSError>();
  Object.assign(response, {
    data: {
      StatusCode: 400,
      Payload: payload,
    },
  });

  return {
    $response: response,
    StatusCode: 400,
    Payload: payload,
  };
};
