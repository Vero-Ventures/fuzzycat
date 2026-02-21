import { mock } from 'bun:test';

export const mockSelect = mock();
export const mockUpdate = mock();
export const mockInsertValues = mock();
export const mockInsert = mock();
export const mockDelete = mock();

// biome-ignore lint/suspicious/noExplicitAny: test mock
export const dbMock: any = {
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
  delete: mockDelete,
};

// Default setup for insert
mockInsertValues.mockImplementation(() => Promise.resolve([]));
mockInsert.mockImplementation(() => ({ values: mockInsertValues }));

export function resetDbMocks() {
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockDelete.mockClear();

  // Re-setup default for insert
  mockInsertValues.mockImplementation(() => Promise.resolve([]));
  mockInsert.mockImplementation(() => ({ values: mockInsertValues }));
}

// biome-ignore lint/suspicious/noExplicitAny: test mock
export function createMockChain(results: any[]) {
  let callIndex = 0;

  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const chain = (res: any) => {
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const obj: any = {
      from: () => obj,
      where: () => obj,
      limit: () => obj,
      offset: () => obj,
      orderBy: () => obj,
      groupBy: () => obj,
      innerJoin: () => obj,
      leftJoin: () => obj,
      returning: () => obj,
      set: () => obj,
      // Make it thenable to support await
      // biome-ignore lint/suspicious/noThenProperty: drizzle query chain
      then: (
        // biome-ignore lint/suspicious/noExplicitAny: test mock
        resolve: any,
      ) => resolve(res),
    };
    return obj;
  };

  mockSelect.mockImplementation(() => {
    const res = results[callIndex] ?? [];
    callIndex++;
    return chain(res);
  });

  mockUpdate.mockImplementation(() => {
    const res = results[callIndex] ?? [];
    callIndex++;
    return chain(res);
  });
}
