import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import sinon from "sinon";
import techRecordResp from "../resources/tech-records-response.json";
import techRecordRespHGV from "../resources/tech-records-response-HGV.json";
import testResultsResp from "../resources/test-results-response.json";
import testResultsRespFail from "../resources/test-results-fail-response.json";
import testResultsRespPrs from "../resources/test-results-prs-response.json";
import testResultsRespEmpty from "../resources/test-results-empty-response.json";
import testResultsRespNoCert from "../resources/test-results-nocert-response.json";
import { AWSError, Lambda, Response } from "aws-sdk";
import { LambdaService } from "../../src/services/LambdaService";
import mockTestResult from "../resources/test-result-with-defect.json";
import defectsMock from "../../tests/resources/defects_mock.json";
import flatDefectsMock from "../../tests/resources/flattened-defects.json";
import testStationsMock from "../../tests/resources/testStationsMock.json";
import { cloneDeep } from "lodash";
import { LOCATION_ENGLISH, LOCATION_WELSH } from "../../src/models/Enums";

describe("Certificate Generation Service", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
  });

  describe("getVehicleMakeAndModel function", () => {
    context("when given a systemNumber with matching record", () => {
      it("should return the record & only invoke the LambdaService once", async () => {
        const LambdaStub = sandbox
          .stub(LambdaService.prototype, "invoke")
          .resolves(AWSResolve(JSON.stringify(techRecordResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
          testResultMock
        );
        expect(LambdaStub.calledOnce).toBeTruthy();
        const lambdaArgs = JSON.parse(
          LambdaStub.firstCall.args[0].Payload as string
        );
        expect(lambdaArgs.queryStringParameters.searchCriteria).toEqual(
          "systemNumber"
        );
        expect(makeAndModel).toEqual({ Make: "Mercedes", Model: "632,01" });
      });
    });

    context(
      "when given a systemNumber  with no matching record and a vin with matching record",
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
          const testResultMock = {
            systemNumber: "134567889",
            vin: "abc123",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.calledTwice).toBeTruthy();
          const lambdaArgs = JSON.parse(
            LambdaStub.secondCall.args[0].Payload as string
          );
          expect(lambdaArgs.queryStringParameters.searchCriteria).toEqual(
            "all"
          );
          expect(makeAndModel).toEqual({ Make: "Mercedes", Model: "632,01" });
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
          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.calledOnce).toBeFalsy();
          expect(LambdaStub.calledTwice).toBeTruthy();
          expect(makeAndModel).toEqual({ Make: "Mercedes", Model: "632,01" });
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
          expect(LambdaStub.calledThrice).toBeTruthy();
          expect(makeAndModel).toEqual({ Make: "Mercedes", Model: "632,01" });
        });
      }
    );

    context(
      "when given a vin, partialVin and VRM with no matching record but a matching TrailerID",
      () => {
        it("should return the record & invoke the LambdaService four times", async () => {
          const LambdaStub = sandbox
            .stub(LambdaService.prototype, "invoke")
            .onFirstCall()
            .resolves(AWSReject("no"))
            .onSecondCall()
            .resolves(AWSReject("no"))
            .onThirdCall()
            .resolves(AWSReject("no"))
            .onCall(3)
            .resolves(AWSResolve(JSON.stringify(techRecordResp)));
          // @ts-ignore
          const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
          );
          const testResultMock = {
            vin: "abc123",
            partialVin: "abc123",
            vrm: "testvrm",
            trailerId: "testTrailerId",
          };
          const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
            testResultMock
          );
          expect(LambdaStub.callCount).toEqual(4);
          expect(makeAndModel).toEqual({ Make: "Mercedes", Model: "632,01" });
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
          expect(e.message).toEqual(
            "Unable to retrieve unique Tech Record for Test Result"
          );
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
          const testResultMock = {
            vin: "abc123",
            trailerId: "testTrailerId",
          };
          try {
            await certGenSvc.getVehicleMakeAndModel(testResultMock);
          } catch (e) {
            expect(LambdaStub.callCount).toEqual(2);
            expect(e).toBeInstanceOf(Error);
            expect(e.message).toEqual(
              "Unable to retrieve unique Tech Record for Test Result"
            );
          }
        });
      }
    );

    context("when lookup returns a PSV tech record", () => {
      it("should return make and model from chassis details", async () => {
        const techRecord = JSON.parse(techRecordResp.body);
        const LambdaStub = sandbox
          .stub(LambdaService.prototype, "invoke")
          .resolves(AWSResolve(JSON.stringify(techRecordResp)));
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel).toEqual({
          Make: techRecord[0].techRecord[0].chassisMake,
          Model: techRecord[0].techRecord[0].chassisModel,
        });
      });
    });

    context("when lookup returns a non-PSV tech record", () => {
      it("should return make and model from not-chassis details", async () => {
        const techRecord = JSON.parse(techRecordRespHGV.body);
        const LambdaStub = sandbox
          .stub(LambdaService.prototype, "invoke")
          .resolves(AWSResolve(JSON.stringify(techRecordRespHGV)));
        const certGenSvc = new CertificateGenerationService(
          // @ts-ignore
          null,
          new LambdaService(new Lambda())
        );
        const testResultMock = {
          systemNumber: "12345678",
        };
        const makeAndModel = await certGenSvc.getVehicleMakeAndModel(
          testResultMock
        );
        expect(makeAndModel).toEqual({
          Make: techRecord[0].techRecord[0].make,
          Model: techRecord[0].techRecord[0].model,
        });
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

    context(
        "when given a systemNumber which returns more than 3 pass or prs",
        () => {
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
              ],
            });
          });
        }
    );

    context(
        "when given a systemNumber which returns tests which include those that are not Annual With Certificate",
        () => {
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
              ],
            });
          });
        }
    );

    context(
        "when given a systemNumber which returns a test result which was fail then prs",
        () => {
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
            expect(odometerHistory).toEqual({
              OdometerHistoryList: [
                {
                  value: 350000,
                  unit: "kilometres",
                  date: "14.01.2019",
                },
              ],
            });
          });
        }
    );

    context(
        "when given a systemNumber which returns a test result which has no test types array",
        () => {
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
              ],
            });
          });
        }
    );
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
      it("should return a filtered flat defect for hgv", () => {
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
    });

    context("test flattenDefectsFromApi method", () => {
      it("should return the defects in a flat array", () => {
        // @ts-ignore
        const certGenSvc = new CertificateGenerationService(
          null as any,
          new LambdaService(new Lambda())
        );
        const flattenedArray = certGenSvc.flattenDefectsFromApi(defectsMock);
        console.log(flattenedArray);
        expect(flattenedArray).toEqual(flatDefectsMock);
        expect(flattenedArray).toHaveLength(2);
      });
    });
  });

  describe("welsh address logic", () => {
    context("test STOP_WELSH_GEN environment variable", () => {
      it("should circumvent the Welsh certificate generation logic and log message if set to true", async () => {
        process.env.STOP_WELSH_GEN = "TRUE";
        const logSpy = jest.spyOn(console, "log");
        const certGenSvc = new CertificateGenerationService(
            null as any,
            new LambdaService(new Lambda())
        );
        await certGenSvc.generateCertificate(mockTestResult)
            .catch(() => {
              expect(logSpy).toHaveBeenCalledWith(
                  "Welsh certificate generation deactivated via environment variable set to TRUE"
              );
            });
      });
    });
  });

  describe("welsh address function", () => {
    context("test getTestStations method", () => {
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
      });
    });

    // TODO: url and api key need to be populated in lookupPostcode method for this test to pass
    // TODO: need to mock secret values as tests fail with security token expired
    // context("test postcode lookup method", () => {
    //   it("should return true for a Welsh postcode", async () => {
    //
    //     const certGenSvc = new CertificateGenerationService(
    //       null as any,
    //       new LambdaService(new Lambda())
    //     );
    //     const welshPostcode = await certGenSvc.lookupPostcode("sa18an");
    //     expect(welshPostcode).toBeTruthy();
    //   });
    //   it("should return false for a non-Welsh postcode", async () => {
    //     const certGenSvc = new CertificateGenerationService(
    //       null as any,
    //       new LambdaService(new Lambda())
    //     );
    //     const welshPostcode = await certGenSvc.lookupPostcode("BS50DA");
    //     expect(welshPostcode).toBeFalsy();
    //   });
    //   it("should return false for a nonsense postcode", async () => {
    //     const certGenSvc = new CertificateGenerationService(
    //       null as any,
    //       new LambdaService(new Lambda())
    //     );
    //     const welshPostcode = await certGenSvc.lookupPostcode("123456");
    //     expect(welshPostcode).toBeFalsy();
    //   });
    //   it("should return false when a postcode is not provided", async () => {
    //     const logSpy = jest.spyOn(console, "log");
    //
    //     const certGenSvc = new CertificateGenerationService(
    //       null as any,
    //       new LambdaService(new Lambda())
    //     );
    //     const welshPostcode = await certGenSvc.lookupPostcode("");
    //     expect(welshPostcode).toBeFalsy();
    //     expect(logSpy).toHaveBeenCalledWith("Error looking up postcode ");
    //   });
    // });
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
