import { PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { certGen } from "./functions/certGen";

const isOffline: boolean =
  !process.env.BRANCH || process.env.BRANCH === "local";

if (isOffline) {
  const SMC = new SecretsManagerClient({});

  const command = new PutSecretValueCommand({
    SecretId: "secretid1",
    SecretString: JSON.stringify({
      accessKeyId: "accessKey1",
      secretAccessKey: "verySecretKey1"
    }),
  });

  SMC.send(command)
}

export { certGen as handler };
