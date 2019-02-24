import rp, {OptionsWithUri} from "request-promise";
import {IMOTConfig} from "../models";
import {Configuration} from "../utils/Configuration";
import {S3BucketService} from "./S3BucketService";
import {Injector} from "../models/injector/Injector";
import S3 from "aws-sdk/clients/s3";
import {AWSError} from "aws-sdk";
import moment from "moment";


class CertificateGenerationService {

    public static async generateCertificate(testResult: any): Promise<{ fileName: string, certificate: string, certificateType: string, certificateOrder: any }> {
        const config: IMOTConfig = Configuration.getInstance().getMOTConfig();
        const testType: any = testResult.testTypes;
        const signature: string | null = await CertificateGenerationService.getSignature(testResult.testerStaffId);
        const passData: any = (testResult.testTypes.testResult === "prs" || testResult.testTypes.testResult === "pass") ? CertificateGenerationService.generatePayload(testResult, "DATA") : undefined;
        const failData: any = (testResult.testTypes.testResult === "prs" || testResult.testTypes.testResult === "fail") ? CertificateGenerationService.generatePayload(testResult, "FAIL_DATA") : undefined;
        const certificateTypes: any = {
            pass: config.documentNames.vtp20,
            fail: config.documentNames.vtp30,
            prs: config.documentNames.psv_prs
        };

        if (!testType) {
            throw new Error("No test type found in the test result");
        }

        const payload = {
            Watermark: "NOT VALID",
            DATA: (passData) ? { ...passData } : undefined,
            FAIL_DATA: (failData) ? { ...failData } : undefined,
            Signature: {
                ImageType: "png",
                ImageData: signature
            }
        };

        const reqParams: OptionsWithUri = {
            method: "POST",
            uri: `${config.endpoint}/${certificateTypes[testResult.testTypes.testResult]}`,
            body: payload,
            headers: {
                "x-api-key": config.api_key
            },
            json: true
        };

        return rp(reqParams)
            .then((response: string) => {
                return {
                    fileName: `${testResult.testResultId}_${testResult.vin}_${testResult.order.current}.pdf`,
                    certificate: response,
                    certificateType: certificateTypes[testResult.testTypes.testResult].split(".")[0],
                    certificateOrder: testResult.order
                };
            });
    }

    public static async getSignature(testerStaffId: string): Promise<string | null> {
        const s3BucketService: S3BucketService = Injector.resolve<S3BucketService>(S3BucketService);
        const signature: S3.Types.GetObjectOutput | void = await s3BucketService.download("cvs-signature", `${testerStaffId}.base64`)
            .catch((error: AWSError) => {
                console.error(`Unable to fetch signature for staff id ${testerStaffId}. ${error.message}`);
            });

        if (signature) {
            return signature.Body!.toString() as string;
        }

        return null;

    }

    private static generatePayload(testResult: any, type: string) {
        const testType: any = testResult.testTypes;
        const defects: any = CertificateGenerationService.generateDefects(testResult.testTypes, type);
        const makeAndModel: any = CertificateGenerationService.getVehicleMakeAndModel(testResult.vin);
        const odometerHistory: any = CertificateGenerationService.getOdometerHistory(testResult.vin);

        if (!testType) {
            throw new Error("No test type found in the test result");
        }

        return {
            TestNumber: testType.testNumber,
            TestStationPNumber: testResult.testStationPNumber,
            TestStationName: testResult.testStationName,
            CurrentOdometer: {
                value: testResult.odometerReading,
                unit: testResult.odometerReadingUnits
            },
            IssuersName: testResult.testerName,
            DateOfTheTest: moment(testType.createdAt).format("D.M.YYYY"),
            ...makeAndModel,
            CountryOfRegistrationCode: testResult.countryOfRegistration,
            VehicleEuClassification: testResult.euVehicleCategory.toUpperCase(),
            RawVIN: testResult.vin,
            RawVRM: testResult.vrm,
            OdometerHistoryList: odometerHistory,
            ExpiryDate: moment(testType.testExpiryDate).format("D.M.YYYY"),
            EarliestDateOfTheNextTest: moment(testType.testAnniversaryDate).format("D.M.YYYY"),
            SeatBeltTested: (testResult.seatbeltInstallationCheckDate) ? "Yes" : "No",
            SeatBeltPreviousCheckDate: testType.lastSeatbeltInstallationCheckDate,
            SeatBeltNumber: testType.numberOfSeatbeltsFitted,
            ...defects
        };
    }

    public static getOdometerHistory(vin: string) {
        // TODO: fetch odometer history for a given VIN
        return [];
    }

    public static getVehicleMakeAndModel(vin: string) {
        // TODO: fetch the vehicle make and vehicle model for a given VIN
        return {
            Make: "[Placeholder]",
            Model: "[Placeholder]"
        };
    }

    private static generateDefects(testTypes: any, type: string) {
        const rawDefects: any = testTypes.defects;
        const defects: any = {
            DangerousDefects: [],
            MajorDefects: [],
            PRSDefects: [],
            MinorDefects: [],
            AdvisoryDefects: []
        };

        rawDefects.forEach((defect: any) => {
            switch (defect.deficiencyCategory.toLowerCase()) {
                case "dangerous":
                    if (testTypes.testResult === "prs" && type === "FAIL_DATA") {
                        defects.PRSDefects.push(CertificateGenerationService.formatDefect(defect));
                    } else if (testTypes.testResult === "fail") {
                        defects.DangerousDefects.push(CertificateGenerationService.formatDefect(defect));
                    }
                    break;
                case "major":
                    if (testTypes.testResult === "prs" && type === "FAIL_DATA") {
                        defects.PRSDefects.push(CertificateGenerationService.formatDefect(defect));
                    } else if (testTypes.testResult === "fail") {
                        defects.MajorDefects.push(CertificateGenerationService.formatDefect(defect));
                    }
                    break;
                case "minor":
                    defects.MinorDefects.push(CertificateGenerationService.formatDefect(defect));
                    break;
                case "advisory":
                    defects.AdvisoryDefects.push(CertificateGenerationService.formatDefect(defect));
                    break;
            }
        });

        Object.entries(defects).forEach(([k, v]: [string, any]) => {
            if (v.length === 0) {
                Object.assign(defects, { [k]: undefined });
            }
        });

        return defects;
    }

    private static formatDefect(defect: any) {
        const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
        let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

        if (defect.deficiencyText) {
            defectString += ` ${defect.deficiencyText}`;
        }

        if (defect.additionalInformation.location.longitudinal) {
            defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location.longitudinal)}`;
        }

        if (defect.additionalInformation.location.vertical) {
            defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location.vertical)}`;
        }

        if (defect.additionalInformation.location.horizontal) {
            defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location.horizontal)}`;
        }

        if (defect.additionalInformation.location.lateral) {
            defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location.lateral)}`;
        }

        defectString += `.`;

        if (defect.additionalInformation.location.rowNumber) {
            defectString += ` Rows: ${defect.additionalInformation.location.rowNumber}.`;
        }

        if (defect.additionalInformation.location.seatNumber) {
            defectString += ` Seats: ${defect.additionalInformation.location.seatNumber}.`;
        }

        if (defect.additionalInformation.location.axleNumber) {
            defectString += ` Axles: ${defect.additionalInformation.location.axleNumber}.`;
        }

        if (defect.additionalInformation.notes) {
            defectString += ` ${defect.additionalInformation.notes}`;
        }

        return defectString;
    }

}

export {CertificateGenerationService};
