import {certGen} from "./functions/certGen";
import {config as AWSConfig} from "aws-sdk";

const isOffline: boolean = (!process.env.BRANCH || process.env.BRANCH === "local");

if (isOffline) {
    console.log("aici");
    AWSConfig.credentials = {
        accessKeyId: "accessKey1",
        secretAccessKey: "verySecretKey1"
    };
}

export {certGen as handler};
