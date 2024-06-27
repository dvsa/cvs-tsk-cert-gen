import { certGen } from "./functions/certGen";

const isOffline: boolean =
  !process.env.BRANCH || process.env.BRANCH === "local";

let credentials = {};

if (isOffline) {
  credentials = {
    accessKeyId: "accessKey1",
    secretAccessKey: "verySecretKey1",
  };
}

export { credentials };
export { certGen as handler };
