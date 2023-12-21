// @ts-ignore
import * as yml from "node-yaml";
import { IInvokeConfig, IMOTConfig, IS3Config } from "../models";
import {ERRORS} from "../models/Enums";
import SecretsManager, {GetSecretValueRequest, GetSecretValueResponse} from "aws-sdk/clients/secretsmanager";
import {ISecret} from "../models/ISecret";

/**
 * Configuration class for retrieving project config
 */
class Configuration {
  private static instance: Configuration;
  private readonly config: any;
  private readonly secretsClient: SecretsManager;

  private constructor(configPath: string) {
    this.secretsClient = new SecretsManager({ region: "eu-west-1" });
    const config = yml.readSync(configPath);

    // Replace environment variable references
    let stringifiedConfig: string = JSON.stringify(config);
    const envRegex: RegExp = /\${(\w+\b):?(\w+\b)?}/g;
    const matches: RegExpMatchArray | null = stringifiedConfig.match(envRegex);

    if (matches) {
      matches.forEach((match: string) => {
        envRegex.lastIndex = 0;
        const captureGroups: RegExpExecArray = envRegex.exec(
          match
        ) as RegExpExecArray;

        // Insert the environment variable if available. If not, insert placeholder. If no placeholder, leave it as is.
        stringifiedConfig = stringifiedConfig.replace(
          match,
          process.env[captureGroups[1]] || captureGroups[2] || captureGroups[1]
        );
      });
    }

    this.config = JSON.parse(stringifiedConfig);
  }

  /**
   * Retrieves the singleton instance of Configuration
   * @returns Configuration
   */
  public static getInstance(): Configuration {
    if (!this.instance) {
      this.instance = new Configuration("../config/config.yml");
    }

    return Configuration.instance;
  }

  /**
   * Retrieves the entire config as an object
   * @returns any
   */
  public getConfig(): any {
    return this.config;
  }

  /**
   * Retrieves the Lambda Invoke config
   * @returns IInvokeConfig
   */
  public getInvokeConfig(): IInvokeConfig {
    if (!this.config.invoke) {
      throw new Error(
        "Lambda Invoke config is not defined in the config file."
      );
    }

    // Not defining BRANCH will default to local
    const env: string =
      !process.env.BRANCH || process.env.BRANCH === "local"
        ? "local"
        : "remote";

    return this.config.invoke[env];
  }

  /**
   * Retrieves the S3 config
   * @returns IS3Config
   */
  public getS3Config(): IS3Config {
    if (!this.config.s3) {
      throw new Error("DynamoDB config is not defined in the config file.");
    }

    // Not defining BRANCH will default to local
    const env: string =
      !process.env.BRANCH || process.env.BRANCH === "local"
        ? "local"
        : "remote";

    return this.config.s3[env];
  }

  /**
   * Retrieves the MOT config
   * @returns IMOTConfig
   */
  public getMOTConfig(): IMOTConfig {
    if (!this.config.mot) {
      throw new Error("The MOT config is not defined in the config file.");
    }

    return this.config.mot;
  }

  /**
   * Retrieves the Welsh address secret key
   * @returns string secret name
   */
  public getWelshSecretKey() {
    if (!process.env.BRANCH || process.env.BRANCH === "local") {
      if (!this.config.welsh.secret_key) {
        throw new Error(ERRORS.SECRET_ENV_VAR_NOT_EXIST);
      } else {
        return this.config.welsh.secret_key;
      }
    } else {
      return process.env.SECRET_KEY;
    }
  }

  /**
   * Method to get the secret details for the Welsh lookup
   * @returns ISecret secret containing SMC url and api key
   */
  public async getSecret() {
    const welshConfigSecretKey: string = this.getWelshSecretKey();

    if (welshConfigSecretKey) {
      try {
        const secretRequest: GetSecretValueRequest = {SecretId: welshConfigSecretKey};
        const secretResponse: GetSecretValueResponse = await this.secretsClient.getSecretValue(secretRequest).promise();

        if (secretResponse.SecretString) {
          const secretConfig: ISecret = JSON.parse(secretResponse.SecretString);
          return secretConfig;
        } else {
          console.log(ERRORS.SECRET_DETAILS_NOT_FOUND);
          return null;
        }
      } catch (error) {
        console.log(error);
        return null;
      }
    } else {
      console.log(ERRORS.SECRET_ENV_VAR_NOT_EXIST);
      return null;
    }
  }
}

export { Configuration };
