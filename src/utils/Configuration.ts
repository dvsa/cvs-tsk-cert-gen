// @ts-ignore
import * as yml from "node-yaml";
import {IDynamoDBConfig, IMOTConfig, IS3Config} from "../models";

class Configuration {

    private static instance: Configuration;
    private readonly config: any;

    private constructor(configPath: string) {
        this.config = yml.readSync(configPath);

        // Replace environment variable references
        let stringifiedConfig: string = JSON.stringify(this.config);
        const envRegex: RegExp = /\${(\w+\b):?(\w+\b)?}/g;
        const matches: RegExpMatchArray | null = stringifiedConfig.match(envRegex);

        if (matches) {
            matches.forEach((match: string) => {
                envRegex.lastIndex = 0;
                const captureGroups: RegExpExecArray = envRegex.exec(match) as RegExpExecArray;

                // Insert the environment variable if available. If not, insert placeholder. If no placeholder, leave it as is.
                stringifiedConfig = stringifiedConfig.replace(match, (process.env[captureGroups[1]] || captureGroups[2] || captureGroups[1]));
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
     * Retrieves the DynamoDB config
     * @returns IDynamoDBConfig
     */
    public getDynamoDBConfig(): IDynamoDBConfig {
        if (!this.config.dynamodb) {
            throw new Error("DynamoDB config is not defined in the config file.");
        }

        // Not defining BRANCH will default to local
        const env: string = (!process.env.BRANCH || process.env.BRANCH === "local") ? "local" : "remote";

        return this.config.dynamodb[env];
    }

    /**
     * Retrieves the DynamoDB config
     * @returns IDynamoDBConfig
     */
    public getS3Config(): IS3Config {
        if (!this.config.s3) {
            throw new Error("DynamoDB config is not defined in the config file.");
        }

        // Not defining BRANCH will default to local
        const env: string = (!process.env.BRANCH || process.env.BRANCH === "local") ? "local" : "remote";

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

}

export { Configuration };
