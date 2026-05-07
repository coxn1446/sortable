import { createContext, useContext } from 'react';

export const ListPageContext = createContext(null);

export function useListPageContext() {
  const v = useContext(ListPageContext);
  if (v == null) {
    throw new Error('useListPageContext must be used within ListPage');
  }
  return v;
}
