import axios, {AxiosInstance} from "axios";
import { Configuration } from "../utils/Configuration";

/**
 * Client to generate instance of Axios that is already configured to call required url
 */
export default async (): Promise<AxiosInstance|null> => {
    try {
        const config = Configuration.getInstance();
        const secretConfig = await config.getSecret();

        if (secretConfig) {
            return axios.create({
                baseURL: secretConfig.url,
                headers: {"x-api-key": secretConfig.key},
                responseType: "json"
            });
        } else {
            console.log("Secret details not found.");
            return null;
        }
    } catch (err) {
        console.error(`Error generating Axios Instance: ${err}`);
        return null;
    }
};
