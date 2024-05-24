import { Service } from 'typedi';
import moment from 'moment';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { ITestResult } from '../../models/ITestResult';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { CERTIFICATE_DATA } from '../../models/Enums';

@Service()
export class TestHistoryCommand implements ICertificatePayloadCommand {
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    const result = {} as ICertificatePayload;

    const { testTypes, testHistory, createdByName, createdAt } = testResult as any;

    if (testHistory) {
      // eslint-disable-next-line
      for (const history of testHistory) {
        // eslint-disable-next-line
        for (const testType of history.testTypes) {
          if (testType.testCode === testTypes.testCode) {
            result.Reissue = {
              Reason: 'Replacement',
              Issuer: createdByName,
              Date: moment(createdAt).format('DD.MM.YYYY'),
            };
            break;
          }
        }
      }
    }

    return result;
  }
}
