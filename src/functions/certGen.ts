import { Callback, Context, Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { Container } from 'typedi';
import { CertificateRequestProcessor } from './CertificateRequestProcessor';

const certGen: Handler = async (event: SQSEvent, context?: Context, callback?: Callback): Promise<SQSBatchResponse> => {
	if (!event?.Records?.length) {
		console.error('ERROR: event is not defined.');
		throw new Error('Event is empty');
	}

	const processRequest = Container.get(CertificateRequestProcessor);

	const batchItemFailures: SQSBatchItemFailure[] = [];

	for (const record of event.Records) {
		try {
			await processRequest.process(JSON.parse(record.body));
		} catch (error) {
			console.error(error);
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	return { batchItemFailures: batchItemFailures };
};

export { certGen };
