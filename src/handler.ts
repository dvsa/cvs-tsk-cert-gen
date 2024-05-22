import { certGen } from "./functions/certGen";
import { DependencyInjection } from "./config/DependencyInjection";

DependencyInjection.register();

export { certGen as handler };
