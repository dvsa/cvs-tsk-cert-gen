import { DependencyInjection } from './config/DependencyInjection';
import { certGen } from './functions/certGen';

DependencyInjection.register();

export { certGen as handler };
