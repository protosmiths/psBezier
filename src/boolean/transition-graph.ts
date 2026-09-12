export interface DirectedTransitionCorridor {
  readonly identity: object;
  readonly tiles: readonly object[];
}

export interface DirectedTransitionEdge {
  readonly identity: object;
  readonly from: object;
  readonly to: object;
  readonly corridor?: DirectedTransitionCorridor;
  readonly corridorTile?: object;
  readonly owner?: object;
}

export type TransitionGraphIssueCode =
  | "duplicate-edge"
  | "unbalanced-vertex"
  | "invalid-corridor-edge"
  | "partial-corridor"
  | "mixed-corridor-owner"
  | "premature-revisit";

export interface TransitionGraphIssue {
  readonly code: TransitionGraphIssueCode;
  readonly message: string;
}

export interface DirectedTransitionCycle {
  readonly edges: readonly DirectedTransitionEdge[];
}

export interface DirectedTransitionGraphReport {
  readonly valid: boolean;
  readonly complete: boolean;
  readonly cycles: readonly DirectedTransitionCycle[];
  readonly issues: readonly TransitionGraphIssue[];
}

function issue(code: TransitionGraphIssueCode, message: string): TransitionGraphIssue {
  return Object.freeze({ code, message });
}

/**
 * Validates and enumerates an already-selected directed result graph.
 *
 * This layer deliberately knows nothing about Bézier geometry or Boolean policy. Object identity,
 * rather than coordinate equality, identifies vertices, directed exits, corridors, tiles, and
 * owners.
 */
export function analyzeDirectedTransitionGraph(
  edges: readonly DirectedTransitionEdge[],
): DirectedTransitionGraphReport {
  const issues: TransitionGraphIssue[] = [];
  const identities = new Set<object>();
  const incoming = new Map<object, DirectedTransitionEdge[]>();
  const outgoing = new Map<object, DirectedTransitionEdge[]>();
  const corridors = new Map<DirectedTransitionCorridor, DirectedTransitionEdge[]>();

  for (const edge of edges) {
    if (identities.has(edge.identity))
      issues.push(
        issue("duplicate-edge", "a directed result edge identity appears more than once"),
      );
    identities.add(edge.identity);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);

    if (edge.corridor === undefined) {
      if (edge.corridorTile !== undefined || edge.owner !== undefined)
        issues.push(
          issue("invalid-corridor-edge", "corridor tile/owner requires corridor membership"),
        );
      continue;
    }
    if (edge.corridorTile === undefined || edge.owner === undefined)
      issues.push(
        issue("invalid-corridor-edge", "a selected corridor edge requires a tile and owner"),
      );
    corridors.set(edge.corridor, [...(corridors.get(edge.corridor) ?? []), edge]);
  }

  const vertices = new Set([...incoming.keys(), ...outgoing.keys()]);
  for (const vertex of vertices) {
    if ((incoming.get(vertex)?.length ?? 0) !== 1 || (outgoing.get(vertex)?.length ?? 0) !== 1)
      issues.push(
        issue(
          "unbalanced-vertex",
          "every selected transition vertex must have exactly one incoming and one outgoing edge",
        ),
      );
  }

  for (const [corridor, selected] of corridors) {
    const selectedTiles = new Set(selected.map((edge) => edge.corridorTile));
    if (
      selected.length !== corridor.tiles.length ||
      corridor.tiles.some((tile) => !selectedTiles.has(tile))
    )
      issues.push(
        issue(
          "partial-corridor",
          "a selected overlap corridor must contain every tile exactly once",
        ),
      );
    const owners = new Set(selected.map((edge) => edge.owner));
    if (owners.size !== 1)
      issues.push(
        issue("mixed-corridor-owner", "one source owner must supply every tile in a corridor"),
      );
  }

  const cycles: DirectedTransitionCycle[] = [];
  if (issues.length === 0) {
    const unused = new Set(edges);
    while (unused.size > 0) {
      const start = unused.values().next().value as DirectedTransitionEdge;
      const cycle: DirectedTransitionEdge[] = [];
      let current = start;
      for (let step = 0; step <= edges.length; step += 1) {
        if (!unused.has(current)) {
          if (current !== start)
            issues.push(
              issue(
                "premature-revisit",
                "a walk revisited a consumed edge other than its starting directed exit",
              ),
            );
          break;
        }
        unused.delete(current);
        cycle.push(current);
        current = outgoing.get(current.to)![0]!;
      }
      cycles.push(Object.freeze({ edges: Object.freeze(cycle) }));
      if (issues.length > 0) break;
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    complete:
      issues.length === 0 &&
      cycles.reduce((sum, cycle) => sum + cycle.edges.length, 0) === edges.length,
    cycles: Object.freeze(cycles),
    issues: Object.freeze(issues),
  });
}
