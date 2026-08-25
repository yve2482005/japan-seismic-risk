export const QUERY_DEFAULTS = {
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
} as const;
