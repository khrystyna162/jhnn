import { parsePaginationQuery } from './pagination.util';

describe('parsePaginationQuery', () => {
  it('returns defaults when query is empty', () => {
    expect(parsePaginationQuery(undefined)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('parses numeric strings and computes skip', () => {
    expect(parsePaginationQuery({ page: '3', limit: '15' })).toEqual({
      page: 3,
      limit: 15,
      skip: 30,
    });
  });

  it('applies min/max boundaries', () => {
    expect(parsePaginationQuery({ page: '0', limit: '999' }, { maxLimit: 100 })).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
    });
  });

  it('uses custom defaults for invalid values', () => {
    expect(
      parsePaginationQuery(
        { page: 'abc', limit: 'xyz' },
        { defaultPage: 2, defaultLimit: 10, maxLimit: 30 },
      ),
    ).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
    });
  });
});
