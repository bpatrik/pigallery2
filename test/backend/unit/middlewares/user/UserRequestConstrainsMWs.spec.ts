import {expect} from 'chai';
import {NextFunction, Request, Response} from 'express';
import {UserRequestConstrainsMWs} from '../../../../../src/backend/middlewares/user/UserRequestConstrainsMWs';
import {ErrorCodes, ErrorDTO} from '../../../../../src/common/entities/Error';
import {TestHelper} from '../../../../TestHelper';

describe('UserRequestConstrainsMWs', () => {
  before(TestHelper.resetConfig);

  describe('notAboveOwnRole', () => {
    // a route without an :id would otherwise skip the check silently
    it('should fail closed without a valid user id', async () => {
      for (const params of [{}, {id: 'abc'}, {id: '-1'}]) {
        let error: ErrorDTO | undefined;
        await UserRequestConstrainsMWs.notAboveOwnRole(
          {params} as unknown as Request,
          {} as Response,
          ((err?: ErrorDTO): void => {
            error = err;
          }) as NextFunction
        );
        expect(error?.code, JSON.stringify(params)).to.equal(ErrorCodes.INPUT_ERROR);
      }
    });
  });
});
