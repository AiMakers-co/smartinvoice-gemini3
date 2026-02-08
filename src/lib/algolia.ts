import { algoliasearch } from "algoliasearch";

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || "";

// Create Algolia client
export const algoliaClient = algoliasearch(appId, searchKey);

// Index name
export const TRANSACTIONS_INDEX = "transactions";

// Search transactions
export async function searchTransactions(
  query: string,
  userId: string,
  options?: {
    filters?: string;
    page?: number;
    hitsPerPage?: number;
  }
) {
  const { filters = "", page = 0, hitsPerPage = 100 } = options || {};
  
  // Always filter by userId for multi-tenant security (quote the value for Algolia)
  const userFilter = `userId:"${userId}"`;
  const combinedFilters = filters ? `${userFilter} AND ${filters}` : userFilter;

  const result = await algoliaClient.searchSingleIndex({
    indexName: TRANSACTIONS_INDEX,
    searchParams: {
      query,
      filters: combinedFilters,
      page,
      hitsPerPage,
      attributesToRetrieve: [
        "objectID",
        "description",
        "amount",
        "type",
        "date",
        "balance",
        "currency",
        "category",
        "reference",
        "merchant",
        "accountId",
        "statementId",
        "userId",
        "confidence",
        "needsReview",
      ],
    },
  });

  return {
    hits: result.hits,
    nbHits: result.nbHits,
    page: result.page,
    nbPages: result.nbPages,
  };
}
