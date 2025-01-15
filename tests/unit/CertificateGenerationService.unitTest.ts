import "reflect-metadata";

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import Container from "typedi";
import { cloneDeep } from "lodash";
import sinon from "sinon";
import { ERRORS, LOCATION_ENGLISH, LOCATION_WELSH } from "../../src/models/Enums";
import { HTTPError } from "../../src/models/HTTPError";
import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import { LambdaService } from "../../src/services/LambdaService";
import defectsMock from "../resources/defects_mock.json";
import flatDefectsMock from "../resources/flattened-defects.json";
import testStationsMock from "../resources/testStationsMock.json";
import queueEventFail from "../resources/queue-event-fail.json";
import queueEventPass from "../resources/queue-event-pass.json";
import queueEventPRS from "../resources/queue-event-prs.json";
import techRecordsPsv from "../resources/tech-records-response-PSV.json";
import techRecordsRwtHgv from "../resources/tech-records-response-rwt-hgv.json";
import techRecordsRwtSearch from "../resources/tech-records-response-rwt-search.json";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";
import techRecordResp from "../resources/tech-records-response.json";
import mockTestWithDefectResult from "../resources/test-result-with-defect.json";
import mockIvaTestWithDefectResult from "../resources/test-result-with-iva-defect.json";
import mockAbandonedTestResult from "../resources/test-result-abandoned.json";
import testResultsRespEmpty from "../resources/test-results-empty-response.json";
import testResultsRespFail from "../resources/test-results-fail-response.json";
import testResultsRespNoCert from "../resources/test-results-nocert-response.json";
import testResultsRespPrs from "../resources/test-results-prs-response.json";
import testResultsResp from "../resources/test-results-response.json";
import { S3BucketService } from "../../src/services/S3BucketService";
import { S3BucketMockService } from "../models/S3BucketMockService";
import { LambdaMockService } from "../models/LambdaMockService";
import { TechRecordRepository } from "../../src/tech-record/TechRecordRepository";
import { TestStationRepository } from "../../src/test-station/TestStationRepository";
import { TestResultRepository } from "../../src/test-result/TestResultRepository";
import { DefectRepository } from "../../src/defect/DefectRepository";
import { TestResultService } from "../../src/test-result/TestResultService";
import { TechRecordService } from "../../src/tech-record/TechRecordService";
import { DefectService } from "../../src/defect/DefectService";
import {IDefectParent, IFeatureFlags} from "../../src/models";

jest.mock("@dvsa/cvs-feature-flags/profiles/vtx", () => ({
  getProfile: mockGetProfile
}));

describe("Certificate Generation Service", () => {
  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  const techRecordRepository = Container.get(TechRecordRepository);
  const callGetTechRecordSpy = jest.spyOn(techRecordRepository, "callGetTechRecords");
  const callSearchTechRecordSpy = jest.spyOn(techRecordRepository, "callSearchTechRecords");
  Container.set(TechRecordRepository, techRecordRepository);

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe("getVehicleMakeAndModel function", () => {
    context("when given a systemNumber with matching record", () => {
      it("should return the record & only invoke the LambdaService once", async () => {
        const techRecordService = Container.get(TechRecordService);

        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await techRecordService.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
        callGetTechRecordSpy.mockClear();
        callSearchTechRecordSpy.mockClear();
      });
    });

    context(
      "when given a systemNumber  with no matching record and a vin with matching record",
      () => {
        it("should return the record & invoke the LambdaService twice", async () => {
          const techRecordService = Container.get(TechRecordService);

          callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            systemNumber: "134567889",
            vin: "abc123",
          };
          const makeAndModel = await techRecordService.getVehicleMakeAndModel(
            testResultMock
          );
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          callGetTechRecordSpy.mockClear();
          callSearchTechRecordSpy.mockClear();
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

          const techRecordService = Container.get(TechRecordService);

          callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
          };
          const makeAndModel = await techRecordService.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.calledOnce).toBeFalsy();
          // expect(LambdaStub.calledTwice).toBeTruthy();
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          callGetTechRecordSpy.mockClear();
          callSearchTechRecordSpy.mockClear();
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

          const techRecordService = Container.get(TechRecordService);

          callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
            vrm: "testvrm",
          };
          const makeAndModel = await techRecordService.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.calledOnce).toBeFalsy();
          expect(LambdaStub.calledTwice).toBeFalsy();
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          callGetTechRecordSpy.mockClear();
          callSearchTechRecordSpy.mockClear();
        });
      }
    );

    context(
      "when given a vin, partialVin and VRM with no matching record but a matching TrailerID",
      () => {
        it("should return the record & invoke the LambdaService four times", async () => {
          const techRecordService = Container.get(TechRecordService);

          callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
            vrm: "testvrm",
            trailerId: "testTrailerId",
          };
          const makeAndModel = await techRecordService.getVehicleMakeAndModel(
            testResultMock
          );
          expect(makeAndModel).toEqual({ Make: "STANLEY", Model: "AUTOTRL" });
          callGetTechRecordSpy.mockClear();
          callSearchTechRecordSpy.mockClear();
        });
      }
    );

    context("when given a vehicle details with no matching records", () => {
      it("should call Tech Records Lambda 4 times and then throw an error", async () => {
        const LambdaStub = sandbox
          .stub(LambdaService.prototype, "invoke")
          .resolves(AWSReject("no"));

        const techRecordService = Container.get(TechRecordService);

        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          vin: "abc123",
          partialVin: "abc123",
          vrm: "testvrm",
          trailerId: "testTrailerId",
        };
        try {
          await techRecordService.getVehicleMakeAndModel(testResultMock);
        } catch (e) {
          expect(LambdaStub.callCount).toEqual(4);
          expect(e).toBeInstanceOf(Error);
          expect((e as unknown as Error).message).toEqual(
            "Unable to retrieve unique Tech Record for Test Result"
          );
          callGetTechRecordSpy.mockClear();
          callSearchTechRecordSpy.mockClear();
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

          const techRecordService = Container.get(TechRecordService);

          callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            vin: "abc123",
            trailerId: "testTrailerId",
          };
          try {
            await techRecordService.getVehicleMakeAndModel(testResultMock);
          } catch (e) {
            expect(LambdaStub.callCount).toEqual(2);
            expect(e).toBeInstanceOf(Error);
            expect((e as unknown as Error).message).toEqual(
              "Unable to retrieve unique Tech Record for Test Result"
            );
            callGetTechRecordSpy.mockClear();
            callSearchTechRecordSpy.mockClear();
          }
        });
      }
    );

    context("when lookup returns a PSV tech record", () => {
      it("should return make and model from chassis details", async () => {
        const techRecordService = Container.get(TechRecordService);

        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordsPsv as any);

        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await techRecordService.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel.Make).toBe("AEC");
        expect(makeAndModel.Model).toBe("RELIANCE");
        callGetTechRecordSpy.mockClear();
        callSearchTechRecordSpy.mockClear();
      });
    });

    context("when lookup returns a non-PSV tech record", () => {
      it("should return make and model from not-chassis details", async () => {
        const techRecordService = Container.get(TechRecordService);

        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);
        callGetTechRecordSpy.mockResolvedValue(techRecordsRwtHgv as any);

        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await techRecordService.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel.Make).toBe("Isuzu");
        expect(makeAndModel.Model).toBe("FM");
        callGetTechRecordSpy.mockClear();
        callSearchTechRecordSpy.mockClear();
      });
    });
  });

  describe("getOdometerHistory function", () => {
    let invokeSpy: jest.SpyInstance;

    beforeAll(() => {
      const lambdaService = Container.get(LambdaService);
      invokeSpy = jest.spyOn(lambdaService, "invoke");
      Container.set(LambdaService, lambdaService);
    });

    afterEach(() => {
      invokeSpy.mockClear();
    });

    context("when given a systemNumber with only failed test results", () => {
      it("should return an empty odometer history list", async () => {
        invokeSpy.mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespFail)));

        const testResultRepository = Container.get(TestResultRepository);
        const systemNumberMock = "12345678";
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );

        expect(invokeSpy).toHaveBeenCalledTimes(1);
        expect(invokeSpy).toBeTruthy();
        expect(odometerHistory).toEqual({ OdometerHistoryList: [] });
      });
    });

    context("when given a systemNumber which returns more than 3 pass or prs", () => {
      it("should return an odometer history no greater than 3", async () => {
        invokeSpy.mockResolvedValue(AWSResolve(JSON.stringify(testResultsResp)));

        const testResultRepository = Container.get(TestResultRepository);
        const systemNumberMock = "12345678";
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );

        expect(invokeSpy).toHaveBeenCalledTimes(1);
        expect(invokeSpy).toBeTruthy();
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
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
          ]
        });
      });
    });

    context("when given a systemNumber which returns tests which include those that are not Annual With Certificate", () => {
      it("should omiting results that are not Annual With Certificate", async () => {
        invokeSpy.mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespNoCert)));

        const testResultRepository = Container.get(TestResultRepository);
        const systemNumberMock = "12345678";
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );

        expect(invokeSpy).toHaveBeenCalledTimes(1);
        expect(invokeSpy).toBeTruthy();
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
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
          ]
        });
      });
    });

    context("when given a systemNumber which returns a test result which was fail then prs", () => {
      it("should return an odometer history which includes test result", async () => {
        invokeSpy.mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespPrs)));

        const testResultRepository = Container.get(TestResultRepository);
        const systemNumberMock = "12345678";
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );

        expect(invokeSpy).toHaveBeenCalledTimes(1);
        expect(invokeSpy).toBeTruthy();
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
            {
              value: 350000,
              unit: "kilometres",
              date: "14.01.2019",
            },
          ]
        });
      });
    });

    context("when given a systemNumber which returns a test result which has no test types array", () => {
      it("should omit the result from the odometer history", async () => {
        invokeSpy.mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespEmpty)));

        const testResultRepository = Container.get(TestResultRepository);
        const systemNumberMock = "12345678";
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );

        expect(invokeSpy).toHaveBeenCalledTimes(1);
        expect(invokeSpy).toBeTruthy();
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
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
          ]
        });
      });
    });
  });

  describe("welsh defect function", () => {
    context("test formatDefectWelsh method", () => {
      it("should return welsh string for hgv vehicle type when there are shared defect refs", () => {
        const defectService = Container.get(DefectService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestWithDefectResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = defectService.formatDefectWelsh(
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
        const defectService = Container.get(DefectService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestWithDefectResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = defectService.formatDefectWelsh(
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
        const defectService = Container.get(DefectService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestWithDefectResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = defectService.formatDefectWelsh(
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
        const defectService = Container.get(DefectService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestWithDefectResult);
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { rowNumber: 1 });
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { seatNumber: 2 });
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { axleNumber: 3 });
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = defectService.formatDefectWelsh(
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
        const defectService = Container.get(DefectService);

        const filterFlatDefectsStub = sandbox
          .stub(defectService, "filterFlatDefects").returns(null);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestWithDefectResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = defectService.formatDefectWelsh(
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
        const defectService = Container.get(DefectService);

        const welshLocation1 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.FRONT
        );
        const welshLocation2 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.REAR
        );
        const welshLocation3 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.UPPER
        );
        const welshLocation4 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.LOWER
        );
        const welshLocation5 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.NEARSIDE
        );
        const welshLocation6 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.OFFSIDE
        );
        const welshLocation7 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.CENTRE
        );
        const welshLocation8 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.INNER
        );
        const welshLocation9 = defectService.convertLocationWelsh(
          LOCATION_ENGLISH.OUTER
        );
        const welshLocation10 = defectService.convertLocationWelsh("mockLocation");
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
        const defectService = Container.get(DefectService);
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = defectService.filterFlatDefects(
          flatDefectsMock,
          "hgv"
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it("should return a filtered flat defect for trl", () => {
        const defectService = Container.get(DefectService);
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = defectService.filterFlatDefects(
          flatDefectsMock,
          "trl"
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it("should return a filtered flat defect for psv", () => {
        const defectService = Container.get(DefectService);
        const flatDefect = flatDefectsMock[1];
        const filterFlatDefect = defectService.filterFlatDefects(
          flatDefectsMock,
          "psv"
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it("should return null if array is empty", () => {
        const defectService = Container.get(DefectService);
        const filterFlatDefect = defectService.filterFlatDefects(
          [],
          "hgv"
        );
        expect(filterFlatDefect).toBeNull();
      });
    });

    context("test flattenDefectsFromApi method", () => {
      it("should return the defects in a flat array", () => {
        const defectService = Container.get(DefectService);
        const flattenedArray = defectService.flattenDefectsFromApi(defectsMock);
        expect(flattenedArray).toEqual(flatDefectsMock);
        expect(flattenedArray).toHaveLength(7);
      });
      it("should log any exceptions flattening defects", () => {
        const defectService = Container.get(DefectService);
        const logSpy = jest.spyOn(console, "error");

        const defectsMockForError = cloneDeep(defectsMock);
        defectsMockForError.forEach = jest.fn(() => {
          throw new Error("Some random error");
        });

        const flattenedArray = defectService.flattenDefectsFromApi(defectsMockForError);
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
    let invokeSpy: jest.SpyInstance;

    beforeAll(() => {
      const lambdaService = Container.get(LambdaService);
      invokeSpy = jest.spyOn(lambdaService, 'invoke');
      Container.set(LambdaService, lambdaService);
    });

    afterAll(() => {
      Container.set(LambdaService, new LambdaMockService());
    });

    context("test getTestStation method", () => {
      const mockStations = testStationsMock;
      it("should return a test station object if invoke is successful", async () => {
        invokeSpy.mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockStations[0]) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStationRepository = Container.get(TestStationRepository);
        const testStation = await testStationRepository.getTestStation('somePNumber');

        expect(testStation).toEqual(mockStations[0]);
        jest.clearAllMocks();
      });
      it("should invoke test stations up to 3 times if there is an issue", async () => {
        const logSpy = jest.spyOn(console, "error");

        const payload = JSON.stringify({ body: '' });
        invokeSpy.mockResolvedValue({
          Payload: payload,
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStationRepository = Container.get(TestStationRepository);
        const testStation = await testStationRepository.getTestStation('somePNumber');

        expect(logSpy).toHaveBeenLastCalledWith(`There was an error retrieving the test station on attempt 3: ${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${payload}.`);
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(testStation).not.toBeNull();
        logSpy.mockClear();
        jest.clearAllMocks();
      });
      it("should return an empty object if test stations invoke is unsuccessful", async () => {
        invokeSpy.mockResolvedValue({
          Payload: JSON.stringify({ body: "" }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStationRepository = Container.get(TestStationRepository);
        const testStation = await testStationRepository.getTestStation('somePNumber');

        expect(testStation).toEqual({});
        jest.clearAllMocks();
      });
      it("should throw error if issue when parsing test station", async () => {
        invokeSpy.mockResolvedValue({
          Payload: JSON.stringify({ body: `No resources match the search criteria.`}),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const testStationRepository = Container.get(TestStationRepository);
        const testStation = await testStationRepository.getTestStation('somePNumber')
          .catch((e) => {
            expect(e).toBeInstanceOf(HTTPError);
          });
        expect(testStation).toEqual({});
        jest.clearAllMocks();
      });
    });

    context("test getDefectTranslations method", () => {
      it("should return an array of defects if invoke is successful", async () => {
        const defectRepository = Container.get(DefectRepository);

        const mockDefects = defectsMock;

        invokeSpy.mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockDefects) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await defectRepository.getDefectTranslations();

        expect(defects).toEqual(mockDefects);
        jest.clearAllMocks();
      });
      it("should invoke defects up to 3 times if there is an issue", async () => {
        const logSpy = jest.spyOn(console, "error");

        const defectRepository = Container.get(DefectRepository);

        const payload = JSON.stringify({ body: "" });
        invokeSpy.mockResolvedValue({
          Payload: payload,
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await defectRepository.getDefectTranslations();

        expect(logSpy).toHaveBeenLastCalledWith(`There was an error retrieving the welsh defect translations on attempt 3: ${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${payload}.`);
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(defects).not.toBeNull();
        logSpy.mockClear();
        jest.clearAllMocks();
      });
      it("should return an empty array if defects invoke is unsuccessful", async () => {
        const defectRepository = Container.get(DefectRepository);

        invokeSpy.mockResolvedValue({
          Payload: JSON.stringify({ body: "" }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await defectRepository.getDefectTranslations();

        expect(defects).toEqual([]);
        jest.clearAllMocks();
      });
      it("should throw error if issue when parsing defects", async () => {
        const defectRepository = Container.get(DefectRepository);

        const mockDefects: IDefectParent[] = [];

        invokeSpy.mockResolvedValue({
          Payload: JSON.stringify({ body: JSON.stringify(mockDefects) }),
          FunctionError: undefined,
          StatusCode: 200,
        });

        const defects = await defectRepository.getDefectTranslations()
          .catch((e) => {
            expect(e).toBeInstanceOf(HTTPError);
          });
        expect(defects).toEqual(mockDefects);
        jest.clearAllMocks();
      });
    });
    describe("Welsh feature flags", () => {
      let certGenSvc: CertificateGenerationService;
      let mockFlags: IFeatureFlags;
      beforeEach(() => {
        certGenSvc = Container.get(CertificateGenerationService);
      });
      afterEach(() => {
        jest.resetAllMocks();
      });

      context("test ShouldTranslateTestResult method", () => {
        const event = cloneDeep(queueEventPass);
        const testResult: any = JSON.parse(event.Records[0].body);

        it("should prevent Welsh translation when global and test result flag are invalid", async () => {
          const globalFlagStub = sandbox.stub(certGenSvc, "isGlobalWelshFlagEnabled").resolves(false);
          const testResultFlagStub = sandbox.stub(certGenSvc, "isTestResultFlagEnabled").resolves(false);
          const isTestStationWelshStub = sandbox.stub(certGenSvc, "isTestStationWelsh").resolves(false);

          const shouldTranslateTestResult = await certGenSvc.shouldTranslateTestResult(testResult);
          expect(shouldTranslateTestResult).toBeFalsy();
          globalFlagStub.restore();
          testResultFlagStub.restore();
          isTestStationWelshStub.restore();
        });

        it("should allow Welsh translation if global and test result flag are enabled", async () => {
          const globalFlagStub = sandbox.stub(certGenSvc, "isGlobalWelshFlagEnabled").resolves(true);
          const testResultFlagStub = sandbox.stub(certGenSvc, "isTestResultFlagEnabled").resolves(true);
          const isTestStationWelshStub = sandbox.stub(certGenSvc, "isTestStationWelsh").resolves(true);

          const shouldTranslateTestResult = await certGenSvc.shouldTranslateTestResult(testResult);
          expect(shouldTranslateTestResult).toBeTruthy();
          globalFlagStub.restore();
          testResultFlagStub.restore();
          isTestStationWelshStub.restore();
        });
      });
      context("test isGlobalWelshFlagEnabled method", () => {
        it("should allow Welsh translation when flag is enabled", () => {
          mockFlags = {
            welshTranslation: {
              enabled: true,
              translatePassTestResult: false,
              translatePrsTestResult: false,
              translateFailTestResult: false,
            },
            abandonedCerts: {
              enabled: false,
            },
          };
          (CertificateGenerationService as any).flags = mockFlags;

          const isWelsh = certGenSvc.isGlobalWelshFlagEnabled();
          expect(isWelsh).toBeTruthy();
        });
        it("should prevent Welsh translation when flag is disabled and log relevant warning", () => {
          mockFlags = {
            welshTranslation: {
              enabled: false,
              translatePassTestResult: false,
              translatePrsTestResult: false,
              translateFailTestResult: false,
            },
            abandonedCerts: {
              enabled: false,
            },
          };
          (CertificateGenerationService as any).flags = mockFlags;

          const logSpy = jest.spyOn(console, "warn");

          const isWelsh = certGenSvc.isGlobalWelshFlagEnabled();
          expect(isWelsh).toBeFalsy();
          expect(logSpy).toHaveBeenCalledWith("Unable to translate any test results: global Welsh flag disabled.");
          logSpy.mockClear();
        });
      });

      context("test isTestResultFlagEnabled method", () => {
        context("when a test result is valid for Welsh translation", () => {
          context("and the PASS Flag is valid", () => {
            const event = cloneDeep(queueEventPass);
            const testResult: any = JSON.parse(event.Records[0].body);

            it("should allow PASS test result for Welsh translation", () => {
              mockFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: true,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
                abandonedCerts: {
                  enabled: false,
                },
              };
              (CertificateGenerationService as any).flags = mockFlags;

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
              expect(isWelsh).toBeTruthy();
            });

            it("should prevent Welsh translation when PASS is disabled and log relevant warning", () => {
              mockFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
                abandonedCerts: {
                  enabled: false,
                },
              };
              (CertificateGenerationService as any).flags = mockFlags;

              const logSpy = jest.spyOn(console, "warn");

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
              expect(isWelsh).toBeFalsy();
              expect(logSpy).toHaveBeenCalledWith(`Unable to translate for test result: pass flag disabled`);
              logSpy.mockClear();
            });
          });

          context("and the PRS Flag is valid", () => {
            const event = cloneDeep(queueEventPRS);
            const testResult: any = JSON.parse(event.Records[0].body);

            it("should allow PRS test result for Welsh translation", () => {
              mockFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: true,
                  translateFailTestResult: false,
                },
                abandonedCerts: {
                  enabled: false,
                },
              };
              (CertificateGenerationService as any).flags = mockFlags;

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
              expect(isWelsh).toBeTruthy();
            });

            it("should prevent Welsh translation when PRS is disabled and log relevant warning", () => {
              mockFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
                abandonedCerts: {
                  enabled: false,
                },
              };
              (CertificateGenerationService as any).flags = mockFlags;

              const logSpy = jest.spyOn(console, "warn");

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
              expect(isWelsh).toBeFalsy();
              expect(logSpy).toHaveBeenCalledWith(`Unable to translate for test result: prs flag disabled`);
              logSpy.mockClear();
            });
          });

          context("and the FAIL flag is valid", () => {
            const event = cloneDeep(queueEventFail);
            const testResult: any = JSON.parse(event.Records[0].body);

            it("should allow FAIL test result for Welsh translation", () => {
              mockFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: true,
                },
                abandonedCerts: {
                  enabled: false,
                },
              };
              (CertificateGenerationService as any).flags = mockFlags;

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
              expect(isWelsh).toBeTruthy();
            });

            it("should prevent Welsh translation when FAIL is disabled and log relevant warning", () => {
              mockFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
                abandonedCerts: {
                  enabled: false,
                },
              };
              (CertificateGenerationService as any).flags = mockFlags;

              const logSpy = jest.spyOn(console, "warn");

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
              expect(isWelsh).toBeFalsy();
              expect(logSpy).toHaveBeenCalledWith(`Unable to translate for test result: fail flag disabled`);
              logSpy.mockClear();
            });
          });
        });

        context("When a test result is invalid for Welsh translation", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testTypes.testResult = "Invalid_test_result";
          it("should prevent translation and log relevant warning", () => {
            const logSpy = jest.spyOn(console, "warn");

            const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Translation not available for this test result type.`);
            logSpy.mockClear();
          });
        });
      });

      context("test isTestStationWelsh method", () => {
        const mockStations = testStationsMock;
        context("with a valid Welsh test station P number", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);

          it("should identify the test requires translation", async () => {

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(mockStations[0]) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeTruthy();
            jest.resetAllMocks();
          });
        });
        context("with a non-Welsh test station P number", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "69-2361520";

          it("should identify that the test does not require translation", async () => {

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(mockStations[2]) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            jest.resetAllMocks();
          });
        });
        context("with an invalid Welsh test station P number", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "Nonsense_P_Number";

          it("should identify no test station exists with that P number and log relevant message", async () => {

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: `No resources match the search criteria.`}),
              FunctionError: undefined,
              StatusCode: 404,
            });

            const logSpy = jest.spyOn(console, "error");

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Failed to retrieve test station details for Nonsense_P_Number`);
            logSpy.mockClear();
            jest.resetAllMocks();
          });
        });
        context("with a test station that does not have test station country populated", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "Nonsense_P_Number";

          it("should return false and log relevant message", async () => {

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(mockStations[4]) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const logSpy = jest.spyOn(console, "error");

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Failed to retrieve test station details for Nonsense_P_Number`);
            logSpy.mockClear();
            jest.resetAllMocks();
          });
        });
        context("with a test station that has an empty string value", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "12345";

          it("should return false and log relevant message", async () => {

            const mockStation = {
              testStationPNumber: "12345",
              testStationCountry: ""
            };

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(mockStation) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const logSpy = jest.spyOn(console, "log");

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Test station country for 12345 is set to `);
            logSpy.mockClear();
            jest.resetAllMocks();
          });
        });
        context("with a test station that has a non-string value", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "Nonsense_P_Number";

          it("should return false and log relevant message", async () => {

            const mockStation = {
              testStationPNumber: "12345",
              testStationCountry: 12345
            };

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(mockStation) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const logSpy = jest.spyOn(console, "log");

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Test station country for Nonsense_P_Number is set to 12345`);
            logSpy.mockClear();
            jest.resetAllMocks();
          });
        });
        context("with a response object that does not have testStation", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "P11223";

          it("should return false and log relevant message", async () => {

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(undefined) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const logSpy = jest.spyOn(console, "error");

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Failed to retrieve test station details for P11223`);
            logSpy.mockClear();
            jest.resetAllMocks();
          });
        });
        context("with a response object that has testStationCountry undefined", () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = "P11223";

          it("should return false and log relevant message", async () => {

            const mockStation = {
              testStationPNumber: "P11223"
            };

            invokeSpy.mockResolvedValue({
              Payload: JSON.stringify({ body: JSON.stringify(mockStation) }),
              FunctionError: undefined,
              StatusCode: 200,
            });

            const logSpy = jest.spyOn(console, "log");

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith(`Test station country for P11223 is set to undefined`);
            logSpy.mockClear();
            jest.resetAllMocks();
          });
        });
      });
    });
  });

  describe("iva 30 logic", () => {
    context("test isBasicIvaTest logic", () => {
      it("should return true if test type id on test result exists in basic array", async () => {
        const testResultService = Container.get(TestResultService);

        const ivaTestResult = cloneDeep(mockIvaTestWithDefectResult);

        const result: boolean = testResultService.isBasicIvaTest(ivaTestResult.testTypes[0].testTypeId);

        expect(result).toBeTruthy();
      });
      it("should return false if test type id on test result does not exist in basic array", async () => {
        const testResultService = Container.get(TestResultService);

        const ivaTestResult = cloneDeep(mockIvaTestWithDefectResult);
        ivaTestResult.testTypes[0].testTypeId = "130";
        ivaTestResult.testTypes[0].testTypeName = "Mutual recognition/ end of series & inspection";

        const result: boolean = testResultService.isBasicIvaTest(ivaTestResult.testTypes[0].testTypeId);

        expect(result).toBeFalsy();
      });
    });
  });

  describe("VTG12/VTP12 logic", () => {
    context("test abandoned test logic", () => {
      it('should return true if test type id on test result exists in allowable array', async () => {
        const testResultService = Container.get(TestResultService);

        const abandonedTestResult = cloneDeep(mockAbandonedTestResult);

        const result: boolean = testResultService.isValidForAbandonedCertificate(abandonedTestResult.testTypes[0].testTypeId);

        expect(result).toBeTruthy();
      });
      it('should return false if test type id on test result does not exist in allowable array', async () => {
        const testResultService = Container.get(TestResultService);

        const abandonedTestResult = cloneDeep(mockAbandonedTestResult);
        abandonedTestResult.testTypes[0].testTypeId = "45";
        abandonedTestResult.testTypes[0].testTypeName = "Low Emissions Certificate (LEC)";

        const result: boolean = testResultService.isValidForAbandonedCertificate(abandonedTestResult.testTypes[0].testTypeId);

        expect(result).toBeFalsy();
      });
    });
  });

  describe("Abandoned Certs feature flags", () => {
    let certGenSvc: CertificateGenerationService;
    let mockFlags: IFeatureFlags;

    beforeEach(() => {
      certGenSvc = Container.get(CertificateGenerationService);
    });
    afterEach(() => {
      jest.resetAllMocks();
    });

    context("test shouldGenerateAbandonedCert method", () => {
      it('should allow abandoned certificate to be generated when global flag is enabled', () => {
        mockFlags = {
          welshTranslation: {
            enabled: true,
            translatePassTestResult: false,
            translatePrsTestResult: false,
            translateFailTestResult: false,
          },
          abandonedCerts: {
            enabled: true,
          },
        };
        (CertificateGenerationService as any).flags = mockFlags;

        const shouldGenerate = certGenSvc.shouldGenerateAbandonedCerts();
        expect(shouldGenerate).toBeTruthy();
      });

      it('should prevent abandoned certificate from being generated when global flag is disabled and log', () => {
        mockFlags = {
          welshTranslation: {
            enabled: true,
            translatePassTestResult: false,
            translatePrsTestResult: false,
            translateFailTestResult: false,
          },
          abandonedCerts: {
            enabled: false,
          },
        };
        (CertificateGenerationService as any).flags = mockFlags;
        const logSpy = jest.spyOn(console, "warn");

        const shouldGenerate = certGenSvc.shouldGenerateAbandonedCerts();
        expect(shouldGenerate).toBe(false);
        expect(logSpy).toHaveBeenCalledWith(`Unable to generate abandoned certificates: global abandoned certificates flag disabled.`);
        logSpy.mockClear();
      });
    });
  });

  describe("Retrieve and Set Flags", () => {
    let certGenSvc: CertificateGenerationService;
    let mockFlags: IFeatureFlags;

    beforeEach(() => {
      certGenSvc = Container.get(CertificateGenerationService);
    });
    afterEach(() => {
      jest.resetAllMocks();
    });

    context("test shouldGenerateAbandonedCert method", () => {
      it('should allow abandoned certificate to be generated when global flag is enabled', () => {
        mockFlags = {
          welshTranslation: {
            enabled: true,
            translatePassTestResult: false,
            translatePrsTestResult: false,
            translateFailTestResult: false,
          },
          abandonedCerts: {
            enabled: true,
          },
        };
        (CertificateGenerationService as any).flags = mockFlags;

        const shouldGenerate = certGenSvc.shouldGenerateAbandonedCerts();
        expect(shouldGenerate).toBeTruthy();
      });

      it('should prevent abandoned certificate from being generated when global flag is disabled and log', () => {
        mockFlags = {
          welshTranslation: {
            enabled: true,
            translatePassTestResult: false,
            translatePrsTestResult: false,
            translateFailTestResult: false,
          },
          abandonedCerts: {
            enabled: false,
          },
        };
        (CertificateGenerationService as any).flags = mockFlags;
        const logSpy = jest.spyOn(console, "warn");

        const shouldGenerate = certGenSvc.shouldGenerateAbandonedCerts();
        expect(shouldGenerate).toBe(false);
        expect(logSpy).toHaveBeenCalledWith(`Unable to generate abandoned certificates: global abandoned certificates flag disabled.`);
        logSpy.mockClear();
      });
    });
  });
});

const AWSResolve = (payload: any) => {
  return {
    $response: { HttpStatusCode: 200, payload },
    $metadata: {},
    StatusCode: 200,
    Payload: payload,
  };
};

const AWSReject = (payload: any) => {
  return {
    $response: { HttpStatusCode: 400, payload },
    $metadata: {},
    StatusCode: 400,
    Payload: payload,
  };
};
