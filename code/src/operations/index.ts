import { FunctionInput, OperationIfc, OperationMap } from '@devrev/typescript-sdk/dist/snap-ins';

export class OperationFactory {
  operationMap: OperationMap;

  constructor(operationMap?: OperationMap) {
    this.operationMap = operationMap || {};
  }

  public getOperation(slug: string, event: FunctionInput): OperationIfc {
    if (!this.operationMap[slug]) {
      throw new Error(`Operation with slug ${slug} not found`);
    }
    return new this.operationMap[slug](event);
  }
}
