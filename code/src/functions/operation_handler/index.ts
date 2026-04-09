import { ExecuteOperationInput, FunctionInput, OperationMap } from '@devrev/typescript-sdk/dist/snap-ins';

import { createGmailLogger } from '../../lib/gmail-logger';
import { OperationFactory } from '../../operations';
import { logFullIncomingEvent } from './log_full_event';
import { SendGmailEmailOp } from './send_gmail_email';

const operationMap: OperationMap = {
  send_gmail_email: SendGmailEmailOp,
};

export const run = async (events: FunctionInput[]) => {
  const logger = createGmailLogger('[operation_handler]');
  logFullIncomingEvent(events[0] ?? { _error: 'events[0] is missing' }, events?.length ?? 0);
  const event = events[0];
  if (!event) {
    throw new Error('No event in events array');
  }

  const payload = event.payload as ExecuteOperationInput;

  if (!payload.metadata) {
    throw new Error('Metadata is missing in the payload.');
  }

  const operationSlug = payload.metadata.slug;
  if (!payload.metadata.namespace) {
    throw new Error('Metadata namespace is missing in the payload.');
  }

  logger.info(`Running operation '${operationSlug}'`);

  const operationFactory = new OperationFactory(operationMap);
  const operation = operationFactory.getOperation(operationSlug, event);
  const ctx = operation.GetContext(event);
  const resources = event.input_data.resources || {};
  return operation.run(ctx, payload, resources);
};

export default run;
