// Convex-shaped React hooks over TanStack Query. The signatures match
// convex/react closely enough that most consumer code keeps working unchanged:
//
//   useQuery(api.users.findUser, { userId })   // → data | undefined
//   useQuery(api.messages.getMessages, "skip") // → undefined while skipped
//   const setGoal = useMutation(api.goals.setGoal); await setGoal({...})
//   const ask = useAction(api.gemini.askCoach); await ask({...})

import {
  useMutation as useTanstackMutation,
  useQuery as useTanstackQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { callEndpoint } from "./client";
import type { ArgsOf, EndpointDef, ResultOf } from "./types";

const SKIP = "skip" as const;
type Skip = typeof SKIP;

export function useQuery<E extends EndpointDef<unknown, unknown>>(
  endpoint: E,
  args: ArgsOf<E> | Skip
): ResultOf<E> | undefined {
  const enabled = args !== SKIP;
  const q = useTanstackQuery({
    queryKey: [endpoint.module, endpoint.name, args],
    queryFn: () => callEndpoint(endpoint, args as ArgsOf<E>),
    enabled,
    staleTime: 1000 * 30, // small TTL — mutations invalidate explicitly
  });
  return enabled ? (q.data as ResultOf<E> | undefined) : undefined;
}

function useMutating<E extends EndpointDef<unknown, unknown>>(endpoint: E) {
  const qc = useQueryClient();
  const m = useTanstackMutation({
    mutationFn: (args: ArgsOf<E>) => callEndpoint(endpoint, args),
    onSuccess: () => {
      // Convex's reactive queries auto-refresh after writes. We can't observe
      // dependencies, so invalidate everything — small data, hackathon scale.
      qc.invalidateQueries();
    },
  });
  // Convex returns a plain async callable. Wrap mutateAsync so callers get the
  // same ergonomics (no need to know about TanStack mutation objects).
  return (args: ArgsOf<E>) => m.mutateAsync(args) as Promise<ResultOf<E>>;
}

export function useMutation<E extends EndpointDef<unknown, unknown>>(endpoint: E) {
  return useMutating(endpoint);
}

export function useAction<E extends EndpointDef<unknown, unknown>>(endpoint: E) {
  return useMutating(endpoint);
}

// Direct callable — used by the videoIndexer module which doesn't live inside
// a React component but still needs to invoke endpoints. Mirrors
// `useConvex().action(...)` from the old code.
export function callApi<E extends EndpointDef<unknown, unknown>>(
  endpoint: E,
  args: ArgsOf<E>
): Promise<ResultOf<E>> {
  return callEndpoint(endpoint, args);
}
